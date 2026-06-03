"""
AI 股票分析系统 - 机构级研究增强版
Tab 1: 单股深度分析
Tab 2: AI 智能选股（新闻质量权重 + 情绪细化 + 主题产业链 + 基本面过滤 + 风险标记）
"""
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta

import pandas as pd
import plotly.graph_objects as go
import requests
import streamlit as st
import yfinance as yf

# ─── 页面配置 ─────────────────────────────────────────────────────────────────
st.set_page_config(page_title="AI 股票分析", page_icon="📈",
                   layout="wide", initial_sidebar_state="collapsed")

st.markdown("""<style>
.news-row{padding:5px 0;border-bottom:1px solid #eee;line-height:1.6}
.badge-src{background:#e9ecef;padding:2px 7px;border-radius:4px;font-size:.78em;margin-right:5px}
.badge-theme{padding:2px 8px;border-radius:10px;font-size:.78em;font-weight:600;margin-right:4px}
.sent-利好{color:#c62828;font-weight:700}
.sent-超预期{color:#ad1457;font-weight:700}
.sent-政策利好{color:#6a1b9a;font-weight:700}
.sent-利空{color:#1565c0;font-weight:700}
.sent-风险{color:#e65100;font-weight:700}
.sent-中性{color:#757575;font-weight:600}
.risk-tag{background:#fff3e0;color:#e65100;padding:2px 6px;border-radius:4px;font-size:.75em;margin-right:4px}
.risk-bad{background:#ffebee;color:#c62828;padding:2px 6px;border-radius:4px;font-size:.75em;margin-right:4px}
.pos-tag{background:#e8f5e9;color:#2e7d32;padding:2px 6px;border-radius:4px;font-size:.75em;margin-right:4px}
</style>""", unsafe_allow_html=True)


# ═══════════════════════════════════════════════════════════════════════════════
#  1. 新闻质量权重（来源可信度）
# ═══════════════════════════════════════════════════════════════════════════════
SOURCE_WEIGHT = {
    # 权威政府 / 央媒
    "新华社": 1.0, "人民日报": 1.0, "央视": 1.0, "国务院": 1.0, "证监会": 1.0,
    # 专业财经媒体
    "财联社": 0.92, "华尔街见闻": 0.90, "Bloomberg": 0.95, "Reuters": 0.95,
    "第一财经": 0.88, "证券时报": 0.88, "上海证券报": 0.88,
    # 专业但偏快
    "36氪": 0.72, "雪球热榜": 0.68,
    # 社交媒体（噪音多）
    "微博热搜": 0.40, "今日头条": 0.38,
    # 默认
    "_default": 0.60,
}

def source_weight(src: str) -> float:
    for k, v in SOURCE_WEIGHT.items():
        if k in src:
            return v
    return SOURCE_WEIGHT["_default"]


# ═══════════════════════════════════════════════════════════════════════════════
#  2. 情绪细化分类（6 类）
# ═══════════════════════════════════════════════════════════════════════════════
SENTIMENT_RULES = [
    ("超预期", ['超预期','大超预期','业绩超','营收超','盈利超','beat','significantly beat','blowout']),
    ("政策利好", ['政策','国务院','发改委','工信部','央行','降息','降准','支持','补贴','专项资金',
                  '十四五','国家战略','纳入','试点','重大项目','批复']),
    ("利好",    ['上涨','涨停','创新高','增长','利好','大涨','强势','突破','中标','斩获订单',
                  '增持','买入','上调目标','签署协议','量产','投产','获批',
                  'surge','gain','growth','record','bullish','upgrade','buy']),
    ("利空",    ['下跌','跌停','亏损','暴跌','不及预期','危机','跌破','减持','下调','警告',
                  'miss','decline','fall','loss','bearish','downgrade','sell','cut']),
    ("风险",    ['ST','退市','调查','处罚','诉讼','违规','欺诈','造假','暴雷','流动性危机',
                  'fraud','investigation','penalty','lawsuit','default','crisis']),
]

def classify_sentiment(text: str) -> tuple[str, float]:
    """返回 (类别, 加权分数)"""
    t = text.lower()
    for label, keywords in SENTIMENT_RULES:
        hits = sum(1 for kw in keywords if kw.lower() in t)
        if hits > 0:
            base = {"超预期": 1.0, "政策利好": 0.85, "利好": 0.6,
                    "利空": -0.6, "风险": -0.9}[label]
            return label, round(base * min(hits, 3) / 3, 3)
    return "中性", 0.0


# ═══════════════════════════════════════════════════════════════════════════════
#  3. 热点主题分类 + 产业链映射
# ═══════════════════════════════════════════════════════════════════════════════
#  persistence: 主题持续性评分(1-5)，越高代表越不容易是"一日游"
THEMES: dict = {
    "AI大模型": {
        "persistence": 5,
        "keywords": ["AI","人工智能","大模型","ChatGPT","GPT","LLM","Sora","智谱","混元",
                     "文心","通义","Kimi","DeepSeek","大语言模型","多模态","Agent","具身"],
        "color": "#7c4dff",
        "upstream":   ["NVDA","AMD","688981.SS","300274.SZ","002415.SZ"],   # 算力/芯片/服务器
        "midstream":  ["MSFT","GOOGL","META","BIDU","9988.HK","0700.HK"],   # 平台/云
        "downstream": ["NTES","BILI","300033.SZ","300059.SZ"],               # 应用/工具
    },
    "机器人": {
        "persistence": 4,
        "keywords": ["机器人","人形机器人","具身智能","工业机器人","协作机器人","灵巧手","执行器",
                     "减速器","Boston Dynamics","Figure","Tesla Bot","Optimus"],
        "color": "#00897b",
        "upstream":   ["300750.SZ","002594.SZ","600031.SS","000157.SZ"],    # 电机/电池/整机
        "midstream":  ["002475.SZ","300760.SZ"],                            # 精密零件
        "downstream": ["TSLA","601127.SS"],                                  # 整车/应用
    },
    "新能源": {
        "persistence": 5,
        "keywords": ["新能源","锂电","储能","光伏","风电","绿电","充电桩","碳中和","双碳",
                     "电动车","EV","钠电池","固态电池","氢能"],
        "color": "#43a047",
        "upstream":   ["300750.SZ","600438.SS","002460.SZ"],                # 电池/材料
        "midstream":  ["601012.SS","300274.SZ","600941.SS"],                 # 组件/逆变器
        "downstream": ["002594.SZ","NIO","LI","XPEV","TSLA"],               # 整车
    },
    "半导体": {
        "persistence": 5,
        "keywords": ["半导体","芯片","集成电路","晶圆","光刻机","EDA","封装","存储","HBM",
                     "先进制程","国产替代","ASML","台积电","中芯","华为芯片","Chiplet"],
        "color": "#1e88e5",
        "upstream":   ["TSM","NVDA","AVGO","QCOM","688981.SS"],             # 代工/设计
        "midstream":  ["INTC","AMD","603659.SS"],                           # IDM/封测
        "downstream": ["AAPL","MSFT","0700.HK","002475.SZ"],                # 整机
    },
    "医药创新": {
        "persistence": 4,
        "keywords": ["创新药","生物药","ADC","GLP-1","减肥药","肿瘤","CAR-T","mRNA",
                     "药明","恒瑞","NMPA","FDA获批","IND","NDA","医疗器械","基因治疗"],
        "color": "#e53935",
        "upstream":   ["603259.SS","300760.SZ"],                            # CXO
        "midstream":  ["600276.SS","688180.SS","300015.SZ"],                 # 药企
        "downstream": ["600511.SS","603858.SS"],                            # 流通/医院
    },
    "消费复苏": {
        "persistence": 3,
        "keywords": ["消费","出行","旅游","餐饮","零售","免税","白酒","食品","电商","直播带货",
                     "平台经济","双十一","618","五一","春节"],
        "color": "#fb8c00",
        "upstream":   ["600519.SS","000858.SZ","002304.SZ"],                # 白酒/食品
        "midstream":  ["9988.HK","JD","PDD"],                               # 电商
        "downstream": ["601888.SS","600036.SS"],                            # 免税/银行
    },
    "军工国防": {
        "persistence": 4,
        "keywords": ["军工","国防","航空","航天","战机","导弹","雷达","北斗","卫星","低轨",
                     "商业航天","火箭","国产大飞机","C919","军费"],
        "color": "#546e7a",
        "upstream":   ["600893.SS","000768.SZ","688122.SS"],
        "midstream":  ["002414.SZ","600435.SS"],
        "downstream": ["601111.SS","600115.SS"],
    },
    "出海跨境": {
        "persistence": 3,
        "keywords": ["出海","跨境","东南亚","中东","一带一路","RCEP","墨西哥","越南",
                     "Temu","SHEIN","跨境电商","外贸","人民币国际化"],
        "color": "#8d6e63",
        "upstream":   ["PDD","002594.SZ"],
        "midstream":  ["002415.SZ","300750.SZ"],
        "downstream": ["BABA","9988.HK","JD"],
    },
    "金融地产": {
        "persistence": 2,
        "keywords": ["降息","降准","LPR","存款利率","房地产","楼市","限购松绑","收储",
                     "城投","债务置换","险资","险资举牌","公募基金"],
        "color": "#5c6bc0",
        "upstream":   ["601398.SS","601288.SS","601939.SS","601988.SS"],
        "midstream":  ["600036.SS","601318.SS"],
        "downstream": ["000001.SZ","600016.SS"],
    },
}

def detect_themes(text: str) -> list[str]:
    matched = []
    t = text
    for theme, cfg in THEMES.items():
        if any(kw in t for kw in cfg["keywords"]):
            matched.append(theme)
    return matched

def theme_color(theme: str) -> str:
    return THEMES.get(theme, {}).get("color", "#90a4ae")

def get_theme_tickers(themes: list[str]) -> dict[str, dict]:
    """
    根据检测到的主题，返回所有产业链 ticker 及其位置信息。
    {ticker: {position, themes, persistence}}
    """
    result: dict[str, dict] = {}
    for theme in themes:
        cfg = THEMES.get(theme, {})
        p = cfg.get("persistence", 3)
        for pos, key in [("上游", "upstream"), ("中游", "midstream"), ("下游", "downstream")]:
            for t in cfg.get(key, []):
                if t not in result:
                    result[t] = {"position": pos, "themes": [], "persistence": p}
                result[t]["themes"].append(theme)
                result[t]["persistence"] = max(result[t]["persistence"], p)
    return result


# ═══════════════════════════════════════════════════════════════════════════════
#  4. 公司名 → Ticker 直接映射
# ═══════════════════════════════════════════════════════════════════════════════
COMPANY_MAP: dict[str, str] = {
    '贵州茅台':'600519.SS','茅台':'600519.SS',
    '宁德时代':'300750.SZ','CATL':'300750.SZ',
    '比亚迪':'002594.SZ','BYD':'002594.SZ',
    '中国平安':'601318.SS','平安':'601318.SS',
    '招商银行':'600036.SS','工商银行':'601398.SS',
    '农业银行':'601288.SS','建设银行':'601939.SS',
    '中国银行':'601988.SS',
    '中石油':'601857.SS','中石化':'600028.SS',
    '中国移动':'600941.SS','中国电信':'601728.SS','中国联通':'600050.SS',
    '中芯国际':'688981.SS','立讯精密':'002475.SZ',
    '海康威视':'002415.SZ','迈瑞医疗':'300760.SZ',
    '恒瑞医药':'600276.SS','药明康德':'603259.SS',
    '隆基绿能':'601012.SS','通威股份':'600438.SS',
    '三一重工':'600031.SS','东方财富':'300059.SZ','同花顺':'300033.SZ',
    '腾讯':'0700.HK','Tencent':'0700.HK',
    '阿里巴巴':'9988.HK','阿里':'9988.HK',
    '美团':'3690.HK','小米':'1810.HK',
    '快手':'1024.HK','百度港股':'9888.HK',
    '英伟达':'NVDA','NVIDIA':'NVDA','Nvidia':'NVDA',
    '苹果':'AAPL','Apple':'AAPL',
    '特斯拉':'TSLA','Tesla':'TSLA',
    '微软':'MSFT','Microsoft':'MSFT',
    '谷歌':'GOOGL','Google':'GOOGL',
    '亚马逊':'AMZN','Amazon':'AMZN',
    'Meta':'META','台积电':'TSM','TSMC':'TSM',
    '高通':'QCOM','博通':'AVGO',
    '京东':'JD','拼多多':'PDD','Temu':'PDD',
    '百度':'BIDU','网易':'NTES',
    '哔哩哔哩':'BILI','B站':'BILI',
    '蔚来':'NIO','理想汽车':'LI','理想':'LI','小鹏':'XPEV',
    'OpenAI':'MSFT','ChatGPT':'MSFT','DeepSeek':'BIDU',
    'AMD':'AMD','Intel':'INTC','英特尔':'INTC',
    '摩根大通':'JPM','高盛':'GS',
    '巴菲特':'BRK-B','伯克希尔':'BRK-B',
}


# ═══════════════════════════════════════════════════════════════════════════════
#  5. Ticker 标准化
# ═══════════════════════════════════════════════════════════════════════════════
def _norm(ticker: str) -> str:
    t = ticker.strip().upper().replace(' ', '')
    if re.match(r'^\d{6}\.(SS|SZ)$', t): return t
    if re.match(r'^\d{4,5}\.HK$', t):    return f"{t.split('.')[0].zfill(4)}.HK"
    if re.match(r'^\d{6}$', t):           return f"{t}.{'SS' if t[0] in '69' else 'SZ'}"
    if re.match(r'^\d{4,5}$', t):         return f"{t.zfill(4)}.HK"
    return t


# ═══════════════════════════════════════════════════════════════════════════════
#  6. 新闻抓取
# ═══════════════════════════════════════════════════════════════════════════════
_HDR = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://newsnow.busiyi.world/",
    "Origin":  "https://newsnow.busiyi.world",
}
SOURCES = {
    "cls":"财联社","wallstreetcn":"华尔街见闻",
    "xueqiu":"雪球热榜","36kr":"36氪","weibo":"微博热搜",
}

@st.cache_data(ttl=180, show_spinner=False)
def fetch_news(max_per: int = 15) -> list:
    items = []
    for sid, sname in SOURCES.items():
        try:
            r = requests.get(f"https://newsnow.busiyi.world/api/s?id={sid}",
                             headers=_HDR, timeout=8)
            if r.status_code == 200:
                for it in r.json().get("items", [])[:max_per]:
                    items.append({
                        "source": sname,
                        "title":  it.get("title", ""),
                        "url":    it.get("url", ""),
                        "ts":     it.get("publish_time", 0),
                    })
        except Exception:
            pass
    return items

@st.cache_data(ttl=180, show_spinner=False)
def fetch_yf_news(sym: str) -> list:
    try:
        return [{"source":"Yahoo Finance","title":n.get("title",""),"url":n.get("link","")}
                for n in (yf.Ticker(sym).news or [])[:8]]
    except Exception:
        return []


# ═══════════════════════════════════════════════════════════════════════════════
#  7. 股价 + 基本面数据
# ═══════════════════════════════════════════════════════════════════════════════
@st.cache_data(ttl=300, show_spinner=False)
def get_stock_full(ticker: str):
    sym = _norm(ticker)
    end, start = datetime.today(), datetime.today() - timedelta(days=120)
    try:
        s  = yf.Ticker(sym)
        df = s.history(start=start, end=end)
        if df.empty:
            return None, {"longName": ticker, "_error": f'找不到 "{sym}"'}
        info = s.info or {}
        info["_sym"] = sym
        return df, info
    except Exception as e:
        return None, {"longName": ticker, "_error": str(e)}

@st.cache_data(ttl=300, show_spinner=False)
def get_quick(ticker: str) -> dict:
    try:
        s  = yf.Ticker(ticker)
        df = s.history(period="60d")
        if df.empty or len(df) < 3:
            return {}
        info = s.info or {}
        last   = df["Close"].iloc[-1]
        prev5  = df["Close"].iloc[-6]  if len(df) >= 6  else df["Close"].iloc[0]
        prev20 = df["Close"].iloc[-21] if len(df) >= 21 else df["Close"].iloc[0]
        avg_vol= df["Volume"].iloc[-20:].mean() if len(df) >= 20 else df["Volume"].mean()
        last_vol = df["Volume"].iloc[-1]
        return {
            "price":    round(last, 2),
            "chg5d":    round((last - prev5)  / prev5  * 100, 2),
            "chg20d":   round((last - prev20) / prev20 * 100, 2),
            "closes":   df["Close"].tolist()[-20:],
            "vol_ratio": round(last_vol / avg_vol, 2) if avg_vol else 1.0,
            # 基本面
            "pe":       info.get("trailingPE") or info.get("forwardPE"),
            "pb":       info.get("priceToBook"),
            "mktcap":   info.get("marketCap"),
            "rev_growth": info.get("revenueGrowth"),   # 营收增速
            "profit_margin": info.get("profitMargins"), # 净利润率
            "debt_equity":   info.get("debtToEquity"),
            "name":     info.get("shortName") or info.get("longName") or ticker,
            "industry": info.get("industry") or info.get("sector") or "—",
            "summary":  (info.get("longBusinessSummary") or "")[:300],
            "52wHigh":  info.get("fiftyTwoWeekHigh"),
            "52wLow":   info.get("fiftyTwoWeekLow"),
            "analystTarget": info.get("targetMeanPrice"),
            "recommendation": info.get("recommendationKey"),
        }
    except Exception:
        return {}


# ═══════════════════════════════════════════════════════════════════════════════
#  行业知识库（景气度 / 周期性 / 产业链议价）
# ═══════════════════════════════════════════════════════════════════════════════
INDUSTRY_PROFILES: dict[str, dict] = {
    "半导体|Semiconductor|Chip|IC|晶圆|芯片": {
        "cycle": "强周期（库存周期约 18 个月）",
        "seasonal": "Q3–Q4 手机/PC 出货旺季，Q1 淡季",
        "upstream_power": "弱（设备依赖 ASML/KLA，材料依赖日企）",
        "downstream_power": "强（技术壁垒高，客户黏性强，切换成本极高）",
        "moat": "技术专利 + 规模效应 + 认证壁垒",
        "competition": "全球寡头，台积电/三星/英特尔三分天下",
        "position_note": "越往上游（设计→代工→封测）附加值越高，设计毛利率最高",
    },
    "电动车|EV|Auto|Automobile|Vehicle|新能源汽车": {
        "cycle": "政策周期叠加换购周期（弱周期）",
        "seasonal": "Q4 冲量/年底促销旺季，Q1 淡季",
        "upstream_power": "弱（依赖锂矿/芯片，供应链集中）",
        "downstream_power": "中（品牌差异大，价格战持续）",
        "moat": "品牌 + 软件生态 + 超充网络",
        "competition": "激烈，中国市场价格战加剧",
        "position_note": "整车毛利率偏低（特斯拉除外），核心零部件/电池利润更稳定",
    },
    "电池|Battery|储能|CATL|LFP|锂电": {
        "cycle": "成长期，受锂矿价格周期叠加影响",
        "seasonal": "Q4 装机旺季（年底抢装）",
        "upstream_power": "弱（锂/钴/镍为大宗，价格波动大）",
        "downstream_power": "中等（宁德时代对整车厂议价力强）",
        "moat": "规模 + 专利 + 产业链一体化绑定",
        "competition": "宁德时代 > 比亚迪 > LG/松下，CR3 较高",
        "position_note": "电池处于新能源产业中游核心，毛利率约 20–25%",
    },
    "软件|Software|SaaS|Cloud|云计算|互联网": {
        "cycle": "弱周期（订阅制收入稳定）",
        "seasonal": "Q4 企业预算年底采购，全年较均匀",
        "upstream_power": "强（边际成本极低，规模效益显著）",
        "downstream_power": "强（迁移成本高，数据锁定效应）",
        "moat": "网络效应 + 数据壁垒 + 客户转换成本",
        "competition": "赢家通吃，头部效应极强",
        "position_note": "轻资产，高毛利（优质 SaaS >70%），关注 ARR 增速和 NDR",
    },
    "人工智能|AI|大模型|LLM|人工智能|机器学习": {
        "cycle": "成长期，受算力投入周期影响",
        "seasonal": "无明显淡旺季，受算力采购周期驱动",
        "upstream_power": "弱（GPU 强依赖英伟达，短期垄断）",
        "downstream_power": "强（模型能力差异大，头部壁垒深）",
        "moat": "数据壁垒 + 算法 + 训练规模",
        "competition": "OpenAI/谷歌/微软/百度/华为多极竞争",
        "position_note": "算力层（最确定）> 模型层 > 应用层，算力卡位最关键",
    },
    "光伏|Solar|新能源|Renewable|风电|储能": {
        "cycle": "政策装机周期（弱周期中含强阶段性）",
        "seasonal": "Q2–Q3 装机旺季，Q1 淡季",
        "upstream_power": "弱（硅料价格波动剧烈）",
        "downstream_power": "弱（组件高度同质化，价格战激烈）",
        "moat": "成本领先 + 规模（强者恒强）",
        "competition": "充分竞争，价格战中，行业出清进行中",
        "position_note": "硅料 > 硅片 > 电池片 > 组件 > 逆变器，逆变器技术壁垒最高",
    },
    "银行|Bank|Financial|金融|保险|Insurance": {
        "cycle": "强周期（紧跟宏观经济与利率政策）",
        "seasonal": "Q1 开门红放贷旺季，全年较均匀",
        "upstream_power": "强（受央行货币政策约束）",
        "downstream_power": "弱（贷款利差持续收窄）",
        "moat": "牌照壁垒 + 客户关系 + 规模效应",
        "competition": "国有大行主导，股份制银行差异化竞争",
        "position_note": "净息差是核心盈利指标，关注不良率和资产质量",
    },
    "消费|Consumer|Food|Retail|零售|餐饮|白酒|酒类": {
        "cycle": "弱周期（刚需消费）",
        "seasonal": "春节/双十一/618 旺季，Q1 业绩最好",
        "upstream_power": "弱（原材料成本传导慢）",
        "downstream_power": "强（品牌溢价高，白酒定价权极强）",
        "moat": "品牌 + 渠道 + 消费心智",
        "competition": "品牌决定格局，白酒/乳制品相对稳定",
        "position_note": "白酒毛利率 >80%，是消费品中护城河最深的细分赛道",
    },
    "医药|Pharma|Drug|生物|Biotech|创新药|器械": {
        "cycle": "弱周期（刚需），但受医保政策影响大",
        "seasonal": "Q4 医院采购旺季（年底预算花完）",
        "upstream_power": "强（原料药自制率决定成本控制）",
        "downstream_power": "强（专利原研药定价权极强）",
        "moat": "专利 + 临床数据 + 渠道准入",
        "competition": "专利药格局好，集采后仿制药竞争激烈",
        "position_note": "创新药 > CXO > 器械 > 仿制药，创新药附加值最高",
    },
    "机器人|Robot|自动化|Automation|无人机|Drone": {
        "cycle": "成长期（渗透率提升主导，弱周期）",
        "seasonal": "年底工厂资本开支旺季",
        "upstream_power": "弱（依赖减速器/伺服电机/传感器供应）",
        "downstream_power": "强（整机技术差距大）",
        "moat": "技术 + 客户定制化 + 认证壁垒",
        "competition": "发那科/安川/ABB/库卡四大家族主导，国产追赶",
        "position_note": "核心零部件（减速器/控制器）利润最丰厚，整机次之",
    },
    "地产|Real Estate|Property|房地产": {
        "cycle": "强周期（跟随货币政策与土地政策）",
        "seasonal": "3–5 月 / 9–10 月传统旺季",
        "upstream_power": "弱（土地依赖政府供应，垄断性强）",
        "downstream_power": "弱（同质化严重，品牌溢价低）",
        "moat": "区域性品牌 + 土地储备质量",
        "competition": "行业深度出清，头部集中度提升",
        "position_note": "现金流 > 利润，关注土储质量、融资能力和去化率",
    },
    "军工|Defense|Aerospace|航空|航天|国防": {
        "cycle": "政策周期（军费预算五年规划驱动）",
        "seasonal": "Q4 交付旺季（年末完成装备交付任务）",
        "upstream_power": "强（军方给予稳定订单和成本加成定价）",
        "downstream_power": "极强（军方是唯一买家，无需市场竞争）",
        "moat": "资质壁垒 + 国家背书 + 核心技术保密",
        "competition": "行政性垄断，竞争不激烈",
        "position_note": "核心配套件弹性 > 整机总装，分系统供应商景气度最高",
    },
}

def match_industry_profile(info: dict) -> dict | None:
    industry = (info.get("industry") or "") + " " + (info.get("sector") or "")
    summary  = (info.get("longBusinessSummary") or "")[:400]
    text = (industry + " " + summary).lower()
    best, best_n = None, 0
    for pattern, profile in INDUSTRY_PROFILES.items():
        hits = sum(1 for kw in pattern.split("|") if kw.lower() in text)
        if hits > best_n:
            best_n, best = hits, profile
    return best if best_n > 0 else None


# ═══════════════════════════════════════════════════════════════════════════════
#  季度财务数据（营收/利润趋势 / R&D / 现金流）
# ═══════════════════════════════════════════════════════════════════════════════
@st.cache_data(ttl=3600, show_spinner=False)
def get_financials(sym: str) -> dict:
    res: dict = {}
    try:
        t = yf.Ticker(sym)

        def _find(df, *keys):
            if df is None or df.empty: return None
            for k in keys:
                if k in df.index:
                    return df.loc[k].dropna().sort_index()
            return None

        qf = t.quarterly_financials
        res["q_revenue"] = _find(qf, "Total Revenue", "Revenue")
        res["q_net"]     = _find(qf, "Net Income", "Net Income Common Stockholders")
        res["q_rd"]      = _find(qf, "Research And Development",
                                      "Research Development", "ResearchAndDevelopment")
        res["q_gross"]   = _find(qf, "Gross Profit", "GrossProfit")

        af = t.financials
        res["a_revenue"] = _find(af, "Total Revenue", "Revenue")
        res["a_rd"]      = _find(af, "Research And Development",
                                      "Research Development", "ResearchAndDevelopment")

        cf = t.cashflow
        res["fcf"]   = _find(cf, "Free Cash Flow", "FreeCashFlow")
        res["capex"] = _find(cf, "Capital Expenditure", "CapitalExpenditure")
    except Exception:
        pass
    return res


# ═══════════════════════════════════════════════════════════════════════════════
#  产业链位置判断
# ═══════════════════════════════════════════════════════════════════════════════
def get_chain_position(sym: str, info: dict) -> dict:
    industry = (info.get("industry") or "") + " " + (info.get("sector") or "")
    summary  = (info.get("longBusinessSummary") or "")[:500]
    text = sym + " " + industry + " " + summary

    matched_themes, position = [], "中游"
    related_up: list[str] = []
    related_dn: list[str] = []

    for theme, cfg in THEMES.items():
        if any(kw in text for kw in cfg["keywords"]):
            matched_themes.append(theme)
            if sym in cfg.get("upstream", []):
                position = "上游"
                related_dn = (cfg.get("midstream", []) + cfg.get("downstream", []))[:4]
            elif sym in cfg.get("midstream", []):
                position = "中游"
                related_up = cfg.get("upstream", [])[:3]
                related_dn = cfg.get("downstream", [])[:3]
            elif sym in cfg.get("downstream", []):
                position = "下游"
                related_up = (cfg.get("upstream", []) + cfg.get("midstream", []))[:4]
            else:
                up_kws = ["material","chemical","mining","equipment","设备","材料","矿"]
                dn_kws = ["retail","consumer","service","application","零售","服务","应用"]
                il = industry.lower()
                if any(k in il for k in up_kws):
                    position = "上游"
                    related_dn = cfg.get("midstream", [])[:3]
                elif any(k in il for k in dn_kws):
                    position = "下游"
                    related_up = (cfg.get("upstream", []) + cfg.get("midstream", []))[:4]
                else:
                    position = "中游"
                    related_up = cfg.get("upstream", [])[:2]
                    related_dn = cfg.get("downstream", [])[:2]

    # 议价能力来自毛利率
    gm = info.get("grossMargins")
    if gm:
        if gm > 0.55:   bargaining = f"极强（毛利率 {gm*100:.1f}%，产品定价权高）"
        elif gm > 0.35: bargaining = f"较强（毛利率 {gm*100:.1f}%）"
        elif gm > 0.20: bargaining = f"中等（毛利率 {gm*100:.1f}%）"
        else:           bargaining = f"偏弱（毛利率 {gm*100:.1f}%，价格竞争激烈）"
    else:
        bargaining = "数据不足"

    return {
        "themes":    matched_themes,
        "position":  position,
        "related_up": list(dict.fromkeys(related_up))[:4],
        "related_dn": list(dict.fromkeys(related_dn))[:4],
        "bargaining": bargaining,
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  8. 风险标记
# ═══════════════════════════════════════════════════════════════════════════════
def risk_flags(_ticker: str, quick: dict, mentions: list) -> list[tuple[str,str]]:
    """返回 [(tag_text, style_class)] 列表"""
    flags = []
    pe = quick.get("pe")
    if pe and pe > 80:
        flags.append((f"PE {pe:.0f}x 较高", "risk-tag"))
    if pe and pe > 150:
        flags[- 1] = (f"PE {pe:.0f}x 极高", "risk-bad")

    pb = quick.get("pb")
    if pb and pb > 15:
        flags.append((f"PB {pb:.1f}x 偏高", "risk-tag"))

    # 52周高位追涨判断
    price   = quick.get("price", 0)
    high52  = quick.get("52wHigh")
    if high52 and price and price / high52 > 0.95:
        flags.append(("近52周高位 ⚠", "risk-tag"))

    # 成交量异动（爆量可能是拉高出货）
    vr = quick.get("vol_ratio", 1)
    if vr > 3:
        flags.append((f"成交量 {vr:.1f}x 异常放量", "risk-tag"))

    # 负债率
    de = quick.get("debt_equity")
    if de and de > 200:
        flags.append((f"负债率 {de:.0f}% 偏高", "risk-tag"))

    # 新闻风险词
    for it in mentions:
        lbl, _ = classify_sentiment(it["title"])
        if lbl == "风险":
            flags.append(("相关风险新闻", "risk-bad"))
            break

    # ST / 退市风险（ticker包含ST字样或市值极低）
    mkt = quick.get("mktcap")
    if mkt and mkt < 3e8:  # 市值<3亿 极小盘
        flags.append(("市值极小 慎入", "risk-bad"))

    return flags


# ═══════════════════════════════════════════════════════════════════════════════
#  9. 综合潜力评分（满分 100）
# ═══════════════════════════════════════════════════════════════════════════════
def calc_score(mentions: list, quick: dict, theme_persistence: int) -> dict:
    """
    新闻质量热度  0-30: 加权提及次数
    情绪强度      0-25: 正面/超预期情绪
    主题持续性    0-15: 主线题材得分高
    基本面        0-20: 增速+利润率+估值合理
    成交量异动    0-10: 温和放量加分，爆量或缩量减分
    """
    # 新闻质量热度
    w_sum = sum(source_weight(it["source"]) for it in mentions)
    heat  = min(w_sum / 5.0, 1.0) * 30

    # 情绪强度（只有正面类才加分）
    sent_pts = 0.0
    for it in mentions:
        lbl, score = classify_sentiment(it["title"])
        w = source_weight(it["source"])
        if lbl in ("超预期", "政策利好", "利好"):
            sent_pts += score * w * 8
    sent_pts = min(sent_pts, 25)

    # 主题持续性（1-5 → 0-15）
    persist_pts = (theme_persistence - 1) / 4 * 15

    # 基本面
    fund_pts = 0.0
    rg = quick.get("rev_growth")
    if rg:
        fund_pts += min(rg * 100, 8)       # 营收增速，最多8分
    pm = quick.get("profit_margin")
    if pm and pm > 0:
        fund_pts += min(pm * 40, 7)        # 净利润率，最多7分
    pe = quick.get("pe")
    if pe and 10 < pe < 40:
        fund_pts += 5                       # 合理PE加5分
    elif pe and 40 <= pe <= 60:
        fund_pts += 2
    fund_pts = min(fund_pts, 20)

    # 成交量
    vr = quick.get("vol_ratio", 1)
    if 1.2 <= vr <= 2.5:
        vol_pts = 8                        # 温和放量最佳
    elif vr > 2.5:
        vol_pts = 3                        # 爆量风险
    elif vr < 0.7:
        vol_pts = 2                        # 缩量不佳
    else:
        vol_pts = 5

    total = heat + sent_pts + persist_pts + fund_pts + vol_pts
    return {
        "total":   round(min(total, 100), 1),
        "heat":    round(heat, 1),
        "sent":    round(sent_pts, 1),
        "persist": round(persist_pts, 1),
        "fund":    round(fund_pts, 1),
        "vol":     round(vol_pts, 1),
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  图表工具
# ═══════════════════════════════════════════════════════════════════════════════
def candlestick_chart(df):
    fig = go.Figure()
    fig.add_trace(go.Candlestick(
        x=df.index, open=df["Open"], high=df["High"],
        low=df["Low"], close=df["Close"],
        increasing_line_color="#e53935", decreasing_line_color="#1e88e5", name="K线"))
    for w, c, n in [(5,"#ff9800","MA5"),(20,"#7e57c2","MA20")]:
        fig.add_trace(go.Scatter(x=df.index, y=df["Close"].rolling(w).mean(),
                                 line=dict(color=c,width=1.2), name=n))
    fig.update_layout(height=400, margin=dict(l=0,r=0,t=12,b=0),
                      xaxis_rangeslider_visible=False,
                      legend=dict(orientation="h",y=1.05),
                      paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                      xaxis=dict(gridcolor="#eee"), yaxis=dict(gridcolor="#eee"))
    return fig

def volume_chart(df):
    colors = ["#e53935" if c>=o else "#1e88e5" for c,o in zip(df["Close"],df["Open"])]
    fig = go.Figure(go.Bar(x=df.index, y=df["Volume"], marker_color=colors))
    fig.update_layout(height=130, margin=dict(l=0,r=0,t=4,b=0),
                      paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                      xaxis=dict(gridcolor="#eee"), yaxis=dict(gridcolor="#eee",tickformat=".2s"),
                      showlegend=False)
    return fig

def gauge_chart(score: float):
    color = "#e53935" if score > 0.1 else "#1e88e5" if score < -0.1 else "#aaa"
    fig = go.Figure(go.Indicator(
        mode="gauge+number", value=score,
        number={"valueformat":"+.3f","font":{"size":26}},
        gauge={"axis":{"range":[-1,1]},"bar":{"color":color,"thickness":0.25},
               "steps":[{"range":[-1,-0.1],"color":"#bbdefb"},
                         {"range":[-0.1,0.1],"color":"#f5f5f5"},
                         {"range":[0.1,1],"color":"#ffcdd2"}],
               "threshold":{"line":{"color":color,"width":3},"thickness":0.75,"value":score}},
        domain={"x":[0,1],"y":[0,1]}))
    fig.update_layout(height=180, margin=dict(l=20,r=20,t=20,b=10),
                      paper_bgcolor="rgba(0,0,0,0)")
    return fig

def sparkline(closes: list):
    color = "#e53935" if closes[-1] >= closes[0] else "#1e88e5"
    fig = go.Figure(go.Scatter(y=closes, mode="lines", line=dict(color=color,width=2)))
    fig.update_layout(height=55, margin=dict(l=0,r=0,t=0,b=0),
                      paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                      xaxis=dict(visible=False), yaxis=dict(visible=False), showlegend=False)
    return fig

def score_bar(score: float):
    colors = [(0,"#ef9a9a"),(40,"#ffcc80"),(65,"#a5d6a7"),(80,"#4caf50")]
    c = colors[0][1]
    for threshold, col in colors:
        if score >= threshold:
            c = col
    fig = go.Figure(go.Bar(x=[score], y=[""], orientation="h",
                           marker_color=c, text=[f"{score}"], textposition="inside"))
    fig.update_layout(height=32, margin=dict(l=0,r=0,t=0,b=0),
                      xaxis=dict(range=[0,100],visible=False),
                      yaxis=dict(visible=False),
                      paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)")
    return fig


# ═══════════════════════════════════════════════════════════════════════════════
#  主界面
# ═══════════════════════════════════════════════════════════════════════════════
st.title("📈 AI 股票分析系统")
tab1, tab2 = st.tabs(["🔍 单股深度分析", "🤖 AI 智能选股"])


# ───────────────────────────────────────────────────────────────────────────────
#  Tab 1：单股深度分析
# ───────────────────────────────────────────────────────────────────────────────
with tab1:
    st.caption("支持 A股（600519）· 港股（00700）· 美股（AAPL）")
    ci, cb = st.columns([4,1])
    with ci:
        ticker_input = st.text_input("代码", key="t1",
            placeholder="AAPL / 600519 / 00700.HK", label_visibility="collapsed")
    with cb:
        st.write("")
        go_btn = st.button("🔍 分析", use_container_width=True, type="primary", key="b1")

    if go_btn and ticker_input.strip():
        with st.spinner("加载行情…"):
            df, info = get_stock_full(ticker_input.strip())
        if info.get("_error"):
            st.error(f"❌ {info['_error']}"); st.stop()

        sym  = info.get("_sym", ticker_input)
        name = info.get("longName") or info.get("shortName") or ticker_input
        st.subheader(f"{name}  `{sym}`")

        # 指标行
        m1,m2,m3,m4 = st.columns(4)
        if df is not None and len(df) >= 2:
            last, prev = df["Close"].iloc[-1], df["Close"].iloc[-2]
            chg = (last-prev)/prev*100
            m1.metric("最新价", f"{last:.2f}", f"{chg:+.2f}%")
            m2.metric("近3月高", f"{df['Close'].max():.2f}")
            m3.metric("近3月低", f"{df['Close'].min():.2f}")
        pe = info.get("trailingPE") or info.get("forwardPE")
        m4.metric("PE", f"{float(pe):.1f}x" if pe else "—")

        # K线 + 成交量
        st.markdown("### 📊 价格走势")
        if df is not None and len(df) > 5:
            st.plotly_chart(candlestick_chart(df), use_container_width=True)
            st.plotly_chart(volume_chart(df), use_container_width=True)

        # 新闻
        st.markdown("### 📰 实时资讯 & 情感")
        is_us = not any(sym.endswith(s) for s in (".SS",".SZ",".HK"))
        all_news = (fetch_yf_news(sym) if is_us else []) + fetch_news()
        cn, cg = st.columns([3,1])
        with cg:
            scores = [classify_sentiment(it["title"])[1] for it in all_news]
            avg_s  = sum(scores)/len(scores) if scores else 0
            st.markdown("**综合情感**")
            st.plotly_chart(gauge_chart(avg_s), use_container_width=True)
        with cn:
            for it in all_news[:16]:
                lbl, s = classify_sentiment(it["title"])
                link = (f'<a href="{it["url"]}" target="_blank">{it["title"]}</a>'
                        if it.get("url") else it["title"])
                st.markdown(
                    f'<div class="news-row"><span class="badge-src">{it["source"]}</span>'
                    f'<span class="sent-{lbl}">[{lbl}]</span> {link}</div>',
                    unsafe_allow_html=True)

        # ── 并行拉取财务数据 ─────────────────────────────────────────────────
        with st.spinner("加载财务数据…"):
            fin  = get_financials(sym)
            chain = get_chain_position(sym, info)
            iprof = match_industry_profile(info)

        # ════════════════════════════════════════════════════════════════════
        #  A. 核心财务指标
        # ════════════════════════════════════════════════════════════════════
        st.markdown("### 📊 核心财务指标")
        ma1,ma2,ma3,ma4,ma5,ma6 = st.columns(6)
        pe    = info.get("trailingPE") or info.get("forwardPE")
        pb    = info.get("priceToBook")
        gm    = info.get("grossMargins")
        om    = info.get("operatingMargins")
        nm    = info.get("profitMargins")
        roe   = info.get("returnOnEquity")
        roa   = info.get("returnOnAssets")
        de    = info.get("debtToEquity")
        cr    = info.get("currentRatio")
        rg    = info.get("revenueGrowth")
        eg    = info.get("earningsGrowth")

        ma1.metric("PE (TTM)",  f"{pe:.1f}x"       if pe   else "—")
        ma2.metric("PB",        f"{pb:.2f}x"        if pb   else "—")
        ma3.metric("毛利率",    f"{gm*100:.1f}%"    if gm   else "—")
        ma4.metric("营业利润率",f"{om*100:.1f}%"    if om   else "—")
        ma5.metric("ROE",       f"{roe*100:.1f}%"   if roe  else "—")
        ma6.metric("负债/权益", f"{de:.0f}%"        if de   else "—")

        mb1,mb2,mb3,mb4,mb5,mb6 = st.columns(6)
        mb1.metric("净利润率",  f"{nm*100:.1f}%"    if nm   else "—")
        mb2.metric("ROA",       f"{roa*100:.1f}%"   if roa  else "—")
        mb3.metric("流动比率",  f"{cr:.2f}"         if cr   else "—")
        mb4.metric("营收增速",  f"{rg*100:.1f}%"    if rg   else "—",
                   delta_color="normal")
        mb5.metric("盈利增速",  f"{eg*100:.1f}%"    if eg   else "—",
                   delta_color="normal")
        tgt = info.get("targetMeanPrice")
        mb6.metric("分析师目标价", f"{tgt:.2f}" if tgt else "—")

        # 营收 + 净利润季度趋势图
        qrev = fin.get("q_revenue")
        qnet = fin.get("q_net")
        if qrev is not None and len(qrev) >= 2:
            qrev = qrev.iloc[-8:]   # 最近8季
            labels = [d.strftime("%yQ%q") if hasattr(d,"strftime") else str(d)[:7]
                      for d in qrev.index]
            fig_rev = go.Figure()
            fig_rev.add_trace(go.Bar(
                x=labels, y=(qrev/1e8).tolist(),
                name="营收(亿)", marker_color="#42a5f5"))
            if qnet is not None and len(qnet) >= 2:
                qnet = qnet.reindex(qrev.index, method="nearest").fillna(0)
                fig_rev.add_trace(go.Scatter(
                    x=labels, y=(qnet/1e8).tolist(),
                    name="净利润(亿)", mode="lines+markers",
                    line=dict(color="#e53935", width=2)))
            fig_rev.update_layout(
                height=260, margin=dict(l=0,r=0,t=28,b=0),
                title="季度营收 & 净利润（近8季）",
                legend=dict(orientation="h",y=1.12),
                paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                yaxis=dict(gridcolor="#eee"), xaxis=dict(gridcolor="#eee"))
            st.plotly_chart(fig_rev, use_container_width=True, key="rev_chart")

        # 自由现金流趋势
        fcf = fin.get("fcf")
        if fcf is not None and len(fcf) >= 2:
            fcf = fcf.iloc[-5:]
            labels_f = [str(d)[:4] for d in fcf.index]
            colors_f = ["#43a047" if v >= 0 else "#e53935" for v in fcf.values]
            fig_fcf = go.Figure(go.Bar(
                x=labels_f, y=(fcf/1e8).tolist(),
                marker_color=colors_f, name="自由现金流(亿)"))
            fig_fcf.update_layout(
                height=200, margin=dict(l=0,r=0,t=28,b=0),
                title="年度自由现金流（亿）",
                paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                yaxis=dict(gridcolor="#eee"))
            st.plotly_chart(fig_fcf, use_container_width=True, key="fcf_chart")

        # ════════════════════════════════════════════════════════════════════
        #  B. 研发与技术壁垒
        # ════════════════════════════════════════════════════════════════════
        with st.expander("🔬 研发与技术壁垒", expanded=True):
            rd_abs  = info.get("researchDevelopment")
            rev_abs = info.get("totalRevenue")
            c1, c2, c3 = st.columns(3)
            if rd_abs:
                c1.metric("年度研发支出", f"${rd_abs/1e8:.1f}亿" if rd_abs > 1e8 else f"${rd_abs/1e6:.0f}M")
            if rd_abs and rev_abs and rev_abs > 0:
                c2.metric("研发强度(R&D/营收)", f"{rd_abs/rev_abs*100:.1f}%",
                          help=">15% 表示高研发密度，如半导体/创新药")
            if info.get("patentCount"):
                c3.metric("专利数量", str(info["patentCount"]))

            # R&D趋势
            q_rd = fin.get("q_rd")
            if q_rd is not None and len(q_rd) >= 2:
                q_rd = q_rd.iloc[-8:]
                fig_rd = go.Figure(go.Bar(
                    x=[str(d)[:7] for d in q_rd.index],
                    y=(q_rd/1e6).tolist(),
                    marker_color="#7e57c2", name="研发投入(M)"))
                fig_rd.update_layout(
                    height=200, margin=dict(l=0,r=0,t=28,b=0),
                    title="季度研发投入趋势",
                    paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                    yaxis=dict(gridcolor="#eee"))
                st.plotly_chart(fig_rd, use_container_width=True, key="rd_chart")
            else:
                st.info("暂无季度研发数据（部分 A 股/港股未公开）")

            # 技术关键词提取
            summary_text = info.get("longBusinessSummary") or ""
            tech_kws = ["patent","proprietary","technology","algorithm","AI","platform",
                        "专利","自研","核心技术","算法","壁垒","护城河","先进制程",
                        "独家","排他","认证","ISO","FDA","NMPA"]
            found_kws = [kw for kw in tech_kws if kw.lower() in summary_text.lower()]
            if found_kws:
                st.markdown("**业务描述中的技术壁垒关键词：** " +
                            " · ".join(f"`{k}`" for k in found_kws[:12]))

        # ════════════════════════════════════════════════════════════════════
        #  C. 主营业务构成
        # ════════════════════════════════════════════════════════════════════
        with st.expander("🏢 主营业务构成", expanded=True):
            st.markdown(f"**行业：** {info.get('industry','—')}  |  **板块：** {info.get('sector','—')}")
            if summary_text:
                st.write(summary_text[:1200])
            # 分析师评级
            rec = info.get("recommendationKey","")
            nb  = info.get("numberOfAnalystOpinions")
            if rec:
                rec_color = {"strong_buy":"#2e7d32","buy":"#43a047",
                             "hold":"#f57c00","sell":"#e53935","strong_sell":"#b71c1c"}
                rc = rec_color.get(rec,"#555")
                st.markdown(
                    f'<span style="background:{rc}20;color:{rc};padding:4px 10px;'
                    f'border-radius:6px;font-weight:700">'
                    f'分析师共识：{rec.replace("_"," ").upper()}'
                    + (f"（{nb} 位覆盖）" if nb else "") + "</span>",
                    unsafe_allow_html=True)
            # 机构持仓
            inst = info.get("heldPercentInstitutions")
            short_pct = info.get("shortPercentOfFloat")
            col_a, col_b = st.columns(2)
            if inst:  col_a.metric("机构持仓比例", f"{inst*100:.1f}%")
            if short_pct: col_b.metric("空头比例(Short Float)", f"{short_pct*100:.1f}%",
                                        delta_color="inverse")

        # ════════════════════════════════════════════════════════════════════
        #  D. 产业链位置 & 议价能力
        # ════════════════════════════════════════════════════════════════════
        with st.expander("🏭 产业链位置 & 上下游议价能力", expanded=True):
            pos_color = {"上游":"#1565c0","中游":"#2e7d32","下游":"#6a1b9a"}.get(
                chain["position"],"#37474f")
            st.markdown(
                f'<span style="background:{pos_color}15;color:{pos_color};'
                f'padding:6px 14px;border-radius:8px;font-size:1.1em;font-weight:700">'
                f'产业链位置：{chain["position"]}</span>',
                unsafe_allow_html=True)
            st.markdown(f"**对上下游综合议价能力：** {chain['bargaining']}")

            if chain["themes"]:
                st.markdown("**所属主题：** " +
                            "  ".join(f'<span class="badge-theme" style="background:{theme_color(t)}20;'
                                      f'color:{theme_color(t)};border:1px solid {theme_color(t)}">{t}</span>'
                                      for t in chain["themes"]),
                            unsafe_allow_html=True)

            cu, cd = st.columns(2)
            with cu:
                if chain["related_up"]:
                    st.markdown("**上游关联公司**")
                    for t in chain["related_up"]:
                        q = get_quick(t)
                        label = q.get("name", t) if q else t
                        chg = q.get("chg5d",0) if q else 0
                        arrow = "▲" if chg >= 0 else "▼"
                        color = "#e53935" if chg >= 0 else "#1e88e5"
                        st.markdown(
                            f'`{t}` {label[:12]}  '
                            f'<span style="color:{color}">{arrow}{abs(chg):.1f}% (5日)</span>',
                            unsafe_allow_html=True)
                else:
                    st.info("暂无上游映射数据")
            with cd:
                if chain["related_dn"]:
                    st.markdown("**下游关联公司**")
                    for t in chain["related_dn"]:
                        q = get_quick(t)
                        label = q.get("name", t) if q else t
                        chg = q.get("chg5d",0) if q else 0
                        arrow = "▲" if chg >= 0 else "▼"
                        color = "#e53935" if chg >= 0 else "#1e88e5"
                        st.markdown(
                            f'`{t}` {label[:12]}  '
                            f'<span style="color:{color}">{arrow}{abs(chg):.1f}% (5日)</span>',
                            unsafe_allow_html=True)
                else:
                    st.info("暂无下游映射数据")

        # ════════════════════════════════════════════════════════════════════
        #  E. 行业景气度 & 竞争格局
        # ════════════════════════════════════════════════════════════════════
        with st.expander("🔄 行业景气度 & 竞争格局", expanded=True):
            if iprof:
                rows = [
                    ("周期性",     iprof.get("cycle",     "—")),
                    ("淡旺季",     iprof.get("seasonal",   "—")),
                    ("对上游议价", iprof.get("upstream_power",   "—")),
                    ("对下游议价", iprof.get("downstream_power",  "—")),
                    ("护城河类型", iprof.get("moat",       "—")),
                    ("竞争格局",   iprof.get("competition","—")),
                    ("产业链要点", iprof.get("position_note","—")),
                ]
                for label, val in rows:
                    st.markdown(f"**{label}：** {val}")
            else:
                st.info("暂未匹配到行业知识库，仅展示原始行业分类。")
                st.write(f"行业：{info.get('industry','—')}  /  板块：{info.get('sector','—')}")

            # 52周价格位置（估值区间可视化）
            price_now = df["Close"].iloc[-1] if df is not None and len(df) else None
            h52 = info.get("fiftyTwoWeekHigh")
            l52 = info.get("fiftyTwoWeekLow")
            if price_now and h52 and l52 and h52 > l52:
                pct = (price_now - l52) / (h52 - l52) * 100
                st.markdown(f"**52 周价格分位（低→高）：{pct:.0f}%**")
                st.progress(int(pct) / 100,
                            text=f"52W低 {l52:.2f}  ←  当前 {price_now:.2f}  →  52W高 {h52:.2f}")

    elif go_btn:
        st.warning("请输入股票代码")


# ───────────────────────────────────────────────────────────────────────────────
#  Tab 2：AI 智能选股（机构级增强）
# ───────────────────────────────────────────────────────────────────────────────
with tab2:
    st.markdown("### 🤖 今日新闻驱动智能选股")
    st.caption("新闻质量权重 · 情绪细化分类 · 主题产业链映射 · 基本面过滤 · 风险标记")

    cc1, cc2, cc3 = st.columns(3)
    with cc1: top_n      = st.slider("推荐数量", 3, 10, 5, key="tn")
    with cc2: min_hits   = st.slider("最少提及次数", 1, 4, 2, key="mh")
    with cc3: chain_mode = st.checkbox("启用产业链扩展", value=True, key="cm",
                                        help="开启后将把新闻主题的上中下游公司也纳入候选")
    run = st.button("🚀 开始选股", use_container_width=True, type="primary", key="run")

    if run:
        bar = st.progress(0, "📡 抓取财经新闻…")

        # ── Step 1: 新闻 ──────────────────────────────────────────────────────
        news_list = fetch_news(max_per=15)
        bar.progress(15, f"✅ {len(news_list)} 条新闻，分析主题…")

        if not news_list:
            st.error("无法获取新闻，检查网络。"); st.stop()

        # ── Step 2: 主题热度统计 ─────────────────────────────────────────────
        theme_count: dict[str,int] = {}
        theme_news:  dict[str,list] = {}
        for it in news_list:
            for th in detect_themes(it["title"]):
                theme_count[th] = theme_count.get(th, 0) + 1
                theme_news.setdefault(th, []).append(it)

        # ── Step 3: 显示今日主题热力榜 ──────────────────────────────────────
        if theme_count:
            st.markdown("#### 🔥 今日热点主题")
            sorted_themes = sorted(theme_count.items(), key=lambda x: x[1], reverse=True)
            badge_html = ""
            for th, cnt in sorted_themes[:8]:
                c = theme_color(th)
                p = THEMES[th]["persistence"]
                stars = "★" * p + "☆" * (5-p)
                badge_html += (f'<span class="badge-theme" style="background:{c}20;color:{c};border:1px solid {c}">'
                               f'{th} {cnt}条 {stars}</span>')
            st.markdown(badge_html, unsafe_allow_html=True)
            st.caption("★ 数越多代表主题持续性越强（AI/半导体/新能源为主线题材）")

        bar.progress(30, "🧩 提取候选股票…")

        # ── Step 4: 收集候选 ticker ─────────────────────────────────────────
        # 直接提及（公司名/括号代码）
        direct: dict[str, list] = {}
        for it in news_list:
            found = set()
            for code in re.findall(r'[（(](\d{6})[)）]', it["title"]):
                found.add(_norm(code))
            for name, tk in COMPANY_MAP.items():
                if name in it["title"]:
                    found.add(tk)
            for t in found:
                direct.setdefault(t, []).append(it)

        direct = {t: ns for t, ns in direct.items() if len(ns) >= min_hits}

        # 产业链扩展
        chain_candidates: dict[str, dict] = {}
        if chain_mode and theme_count:
            active_themes = [th for th, cnt in theme_count.items() if cnt >= 2]
            chain_candidates = get_theme_tickers(active_themes)

        # 合并去重
        all_tickers: dict[str, dict] = {}
        for t, ns in direct.items():
            all_tickers[t] = {"mentions": ns, "position": "直接提及",
                               "themes": detect_themes(" ".join(x["title"] for x in ns)),
                               "persistence": max((THEMES.get(th,{}).get("persistence",3)
                                                   for th in detect_themes(" ".join(x["title"] for x in ns))),
                                                  default=3)}
        for t, meta in chain_candidates.items():
            if t not in all_tickers:
                # 用主题下的新闻作为支撑
                th_news = []
                for th in meta["themes"]:
                    th_news.extend(theme_news.get(th, []))
                all_tickers[t] = {"mentions": th_news[:5],
                                   "position": meta["position"],
                                   "themes": meta["themes"],
                                   "persistence": meta["persistence"]}

        bar.progress(45, f"📊 获取 {len(all_tickers)} 只候选股票行情…")

        # ── Step 5: 并行获取行情 ─────────────────────────────────────────────
        quick_map: dict[str, dict] = {}
        def _fetch(t): return t, get_quick(t)
        with ThreadPoolExecutor(max_workers=10) as ex:
            futs = {ex.submit(_fetch, t): t for t in all_tickers}
            done = 0
            for fut in as_completed(futs):
                t, q = fut.result()
                if q:
                    quick_map[t] = q
                done += 1
                bar.progress(45 + int(done/len(all_tickers)*35),
                             f"📊 行情 {done}/{len(all_tickers)}…")

        bar.progress(85, "🧠 综合评分…")

        # ── Step 6: 评分 + 排序 ─────────────────────────────────────────────
        scored = []
        for t, meta in all_tickers.items():
            q = quick_map.get(t)
            if not q:
                continue
            sc = calc_score(meta["mentions"], q, meta["persistence"])
            flags = risk_flags(t, q, meta["mentions"])
            scored.append({
                "ticker":   t,
                "name":     q.get("name", t),
                "quick":    q,
                "mentions": meta["mentions"],
                "position": meta["position"],
                "themes":   meta["themes"],
                "score":    sc,
                "flags":    flags,
            })

        scored.sort(key=lambda x: x["score"]["total"], reverse=True)
        top = scored[:top_n]
        bar.progress(100, "✅ 完成！")
        bar.empty()

        # ── Step 7: 展示结果 ─────────────────────────────────────────────────
        st.markdown(f"---\n#### 📊 今日潜力榜 Top {len(top)}")
        st.caption(f"分析时间：{datetime.now().strftime('%Y-%m-%d %H:%M')} · "
                   f"新闻 {len(news_list)} 条 · 候选 {len(scored)} 只")

        for rank, item in enumerate(top, 1):
            t     = item["ticker"]
            q     = item["quick"]
            sc    = item["score"]
            flags = item["flags"]
            closes = q.get("closes", [])

            with st.expander(
                f"#{rank}  {item['name'][:18]}  `{t}`  —  综合评分 **{sc['total']}** / 100",
                expanded=(rank <= 3)
            ):
                col_l, col_r = st.columns([3, 2])

                with col_l:
                    # 主题 + 产业链位置
                    badges = ""
                    for th in item["themes"][:4]:
                        c = theme_color(th)
                        badges += f'<span class="badge-theme" style="background:{c}20;color:{c};border:1px solid {c}">{th}</span>'
                    pos_color = {"上游":"#1565c0","中游":"#2e7d32","下游":"#6a1b9a","直接提及":"#37474f"}.get(item["position"],"#37474f")
                    badges += f'<span class="badge-theme" style="background:#eceff1;color:{pos_color};border:1px solid {pos_color}">{item["position"]}</span>'
                    st.markdown(badges, unsafe_allow_html=True)

                    # 风险标记
                    if flags:
                        flag_html = "".join(f'<span class="{cls}">{txt}</span>' for txt,cls in flags)
                        st.markdown(flag_html, unsafe_allow_html=True)

                    # 评分分解条
                    st.plotly_chart(score_bar(sc["total"]), use_container_width=True, key=f"score_bar_{rank}")
                    st.caption(
                        f"新闻热度 {sc['heat']} · 情绪 {sc['sent']} · "
                        f"主题持续 {sc['persist']} · 基本面 {sc['fund']} · 量能 {sc['vol']}"
                    )

                    # 关键财务
                    fa, fb, fc_ = st.columns(3)
                    fa.metric("最新价", f"{q.get('price','—')}", f"{q.get('chg5d',0):+.1f}% 5日")
                    fb.metric("PE", f"{q['pe']:.1f}x" if q.get('pe') else "—")
                    fc_.metric("20日涨跌", f"{q.get('chg20d',0):+.1f}%")

                    fd2, fe2 = st.columns(2)
                    rg = q.get("rev_growth")
                    fd2.metric("营收增速", f"{rg*100:.1f}%" if rg else "—")
                    pm = q.get("profit_margin")
                    fe2.metric("净利润率", f"{pm*100:.1f}%" if pm else "—")

                    # 分析师评级
                    rec = q.get("recommendation","")
                    tgt = q.get("analystTarget")
                    if rec or tgt:
                        st.markdown(
                            f'<span class="pos-tag">分析师: {rec.upper() if rec else "—"}</span>'
                            + (f'<span class="pos-tag">目标价 {tgt:.2f}</span>' if tgt else ""),
                            unsafe_allow_html=True)

                    # 主营业务
                    if q.get("summary"):
                        st.markdown(f"**主营业务：** {q['summary']}", unsafe_allow_html=False)

                with col_r:
                    # 迷你走势图
                    if closes and len(closes) > 3:
                        st.plotly_chart(sparkline(closes), use_container_width=True, key=f"sparkline_{rank}")
                    mkt = q.get("mktcap")
                    if mkt:
                        st.caption(f"市值 {'${:.1f}B'.format(mkt/1e9) if mkt>1e9 else '${:.0f}M'.format(mkt/1e6)}"
                                   f"  |  行业：{q.get('industry','—')}")
                    vr = q.get("vol_ratio",1)
                    vol_label = "🔥 放量" if vr > 1.5 else "📉 缩量" if vr < 0.7 else "正常量能"
                    st.caption(f"量能比 {vr:.1f}x  {vol_label}")

                    # 支撑新闻
                    st.markdown("**相关新闻：**")
                    for it in item["mentions"][:4]:
                        lbl, _ = classify_sentiment(it["title"])
                        link = (f'<a href="{it["url"]}" target="_blank">{it["title"][:45]}…</a>'
                                if it.get("url") else it["title"][:45])
                        st.markdown(
                            f'<div class="news-row" style="font-size:.88em">'
                            f'<span class="badge-src">{it["source"]}</span>'
                            f'<span class="sent-{lbl}">[{lbl}]</span> {link}</div>',
                            unsafe_allow_html=True)

        # 未入榜明细
        if len(scored) > top_n:
            rest = scored[top_n:]
            with st.expander(f"其余 {len(rest)} 只候选（未入榜）"):
                rows = [{"代码":x["ticker"],"名称":x["name"][:12],
                         "综合分":x["score"]["total"],"提及":len(x["mentions"]),
                         "最新价":x["quick"].get("price","—"),
                         "5日%":x["quick"].get("chg5d","—"),
                         "PE":round(x["quick"]["pe"],1) if x["quick"].get("pe") else "—",
                         "主题":"/".join(x["themes"][:2])} for x in rest]
                st.dataframe(pd.DataFrame(rows), use_container_width=True)

    else:
        st.info("点击「🚀 开始选股」启动分析")
        st.markdown("""
#### 评分体系说明

| 维度 | 满分 | 说明 |
|------|------|------|
| 新闻质量热度 | 30 | 按来源权重加权（央媒1.0 > 财联社0.92 > 微博0.4） |
| 情绪细化强度 | 25 | 超预期>政策利好>一般利好，负面和风险不加分 |
| 主题持续性 | 15 | AI/新能源/半导体(5★) > 消费/金融(2★) |
| 基本面质量 | 20 | 营收增速 + 净利润率 + PE合理性 |
| 量能信号 | 10 | 温和放量最佳，爆量/缩量扣分 |

#### 风险标记说明
- 🟠 `PE极高` / `高位追涨` / `爆量异常`：提示性警告，需自行判断
- 🔴 `相关风险新闻` / `市值极小`：建议谨慎

> ⚠️ 本工具仅供信息参考，不构成任何投资建议。股市有风险，投资需谨慎。
""")

st.markdown("---")
st.caption("数据来源：Yahoo Finance · NewsNow · 财联社 · 华尔街见闻 · 雪球  |  ⚠️ 仅供参考，不构成投资建议")
