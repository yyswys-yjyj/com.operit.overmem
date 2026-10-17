# OverMem | 旧忆重逢

<div align="center">
    <img src="https://visitor.serveryyswys.top/cnt/overmem" alt="OverMem | 旧忆重逢"></img><br>
    <i>*那些被遗忘的对话，终将再次被记起。*</i><br>
    简体中文 | <a href="./doc/README.en.md">English</a>
    <br><br>
    <a href="https://github.com/yyswys-yjyj/com.operit.overmem"><img src="https://img.shields.io/badge/GitHub-OverMem-blue?style=for-the-badge&logo=github"></img></a>
    <a href="https://git.repo.archive.serveryyswys.top/yyswys-yjyj/com.operit.overmem"><img src="https://img.shields.io/badge/Gitea-OverMem-green?style=for-the-badge&logo=gitea"></img></a>
    <img src="https://img.shields.io/badge/version-0.2.0--Beta-orange?style=for-the-badge"></img>
    <a href="https://github.com/yyswys-yjyj/com.operit.overmem/LICENSE"><img src="https://img.shields.io/badge/License-GPL--3.0-green?style=for-the-badge"></img></a>
    <img src="https://img.shields.io/github/stars/yyswys-yjyj/com.operit.overmem?style=for-the-badge&logo=github&color=yellow"></img>
</div>
<br>

**当你和 AI 聊了许久，聊得久了，随着会话被压缩，AI 会慢慢淡忘你们之间的点点滴滴。**
**旧忆重逢** 是一个记忆库插件，旨在让 AI 记住你们的过去，助力守护着你们之间的回忆。

## 描述与架构设计

相信你在点进这个插件页面的那一刻，一定是为了寻找一个能让你和 AI 之间的回忆得以延续的解决方案。
OverMem 的方案基于一个根本性的认知：**真实的记忆不是档案柜，而是一张会随时间流动、重组、淡出的网**。

我们放弃了传统「线性表」的做法——那种把对话按时间顺序切成块，再逐级压缩的思路。取而代之的是一张**拓扑化的记忆网络**：每个对话片段是图中的一个节点，节点之间由三种边连接，形成一张可传播、可衰减、可重组的认知图。

AI 的回忆也因此变得生动：可能会忘记，可能会记错，有时候还会想不出来，但会在某个契机下突然灵光一现。

### 记忆系统的三层语义

OverMem 的三层记忆不是按「数量」分级，而是按**抽象层级**递进：

```mermaid
graph TB
    E["事件层<br/><i>事件层 (短期)</i>"]
    T["主题层<br/><i>主题层 (中期)</i>"]
    N["叙事层<br/><i>叙事层 (长期)</i>"]

    E -->|"从片段中抽象出反复出现的模式"| T
    T -->|"把多个主题编织成有开头和转折的故事线"| N

    E -.->|例如| E1["「周二下午修了个数据库并发 bug」"]
    T -.->|例如| T1["「用户最近持续跟性能问题纠缠，<br/>情绪从焦虑转向决心」"]
    N -.->|例如| N1["「从 3 月认识用户开始，我们一起从零<br/>做出了记忆系统，中间经历了重复记录、<br/>连接失效等波折，现在逐步稳定」"]

    style E fill:#E8F5E9,stroke:#4CAF50
    style T fill:#FFF3E0,stroke:#FF9800
    style N fill:#F3E5F5,stroke:#9C27B0
```

- **事件层**记录「发生了什么」
- **主题层**记录「反复出现的规律是什么」
- **叙事层**记录「这一切意味着什么」

三次抽象不是压缩，而是**视角切换**。同一个经历在三层里都有表示，检索时按输入的性质选择合适的一层。

### 记忆网络的拓扑结构

每一条消息、每一个事件块、每一份主题或叙事总结，都是网络中的一个**节点**。节点之间由三种**边**连接：

```mermaid
graph LR
    subgraph 消息链
        M1((msg1)) -->|time| M2((msg2))
        M2 -->|time| M3((msg3))
        M3 -->|time| M4((msg4))
    end

    subgraph 折叠树
        M1 & M2 -.->|fold| B1((block1))
        M3 & M4 -.->|fold| B2((block2))
        B1 & B2 -.->|fold| Mid((mid))
        Mid -.->|fold| Long((long))
    end

    Long -.->|recall| M4

    classDef msg fill:#E3F2FD,stroke:#2196F3
    classDef blk fill:#E8F5E9,stroke:#4CAF50
    classDef mid fill:#FFF3E0,stroke:#FF9800
    classDef lng fill:#F3E5F5,stroke:#9C27B0

    class M1,M2,M3,M4 msg
    class B1,B2 blk
    class Mid mid
    class Long lng

    linkStyle 0,1,2 stroke:#2196F3,stroke-width:2px
    linkStyle 3,4,5,6,7 stroke:#9C27B0,stroke-dasharray:5,3
    linkStyle 8 stroke:#F44336,stroke-width:2px,stroke-dasharray:2,2
```

| 边 | 语义 | 衰减 |
|---|---|---|
| **time** | 时间上相邻的两条消息 | 幂律衰减（艾宾浩斯曲线） |
| **fold** | 高层节点折叠自低层节点 | 永不衰减（结构边） |
| **recall** | 长期记忆被回忆后回链到当前 | 幂律衰减（较慢） |

**关键设计**：
- 时间是单向的链，节点沿链排列，形成"记忆的时间轴"
- 折叠是自下而上的树，从原始对话逐步抽象为事件、主题、叙事
- 回忆是长期节点被想起时，与当前时刻建立的临时连接

## 完整数据流

下面这张时序图展示了一条用户消息从发送到记忆入库的完整过程：

```mermaid
sequenceDiagram
    autonumber

    participant U as 用户
    participant O as Operit AI
    participant H as OverMem Hook
    participant DB as mem.db

    U->>O: 输入消息
    O->>H: 触发 message_processing
    activate H
    H->>DB: 查询当前 pending user
    alt 上一轮未固化
        H->>DB: 固化上轮 pending（user+assistant → block）
    end
    H->>DB: 生成 MSG_ID，写入本轮 user (pending=1)
    deactivate H

    O->>H: 触发 prompt_before_process
    activate H
    H->>DB: 读取 pending user 的 MSG_ID
    H->>DB: ChainWalker 检索记忆
    H->>DB: 记录 injection_log（幂等）
    H-->>O: 返回带 [MSG_ID] + 记忆的 attachment
    deactivate H

    O->>U: 流式输出 AI 回复

    loop 每次 token 更新
        O->>H: 触发 message_persisted
        activate H
        H->>DB: 覆盖 pending assistant 内容
        deactivate H
    end

    Note over U,DB: 下一轮用户消息到达时，<br/>本轮 user+assistant 对将被固化为 block
```

**几个设计要点**：

1. **MSG_ID 是对话对的唯一标识**：每条 user 消息生成一个，无论后面有没有触发记忆检索，都会写入数据库。用途是让模型识别"同一轮对话"——用户编辑重发或重新生成 AI 回复时，attachment 中的 MSG_ID 保持不变。
2. **消息和记忆写入解耦**：即使当前没有可注入的记忆，user 也会正常入库。
3. **流式覆盖**：assistant 回复期间的每次 hook 都覆盖同一条 pending 记录，避免产生碎片。
4. **暂存区驱动**：整个写入依赖 `is_pending=1` 的标记，每轮新 user 到来时把上一轮固化。

## 记忆检索机制

检索不是 SQL 查询，而是**激活扩散**。从若干个"种子"出发，沿着网络中的边向外传播激活值，最终收集被激活最强的节点。

```mermaid
flowchart TD
    Input[用户输入] --> Tokenize[分词 tokenize]

    subgraph 种子构建
        Tokenize --> ContentSeeds[内容种子<br/>关键词匹配历史块]
        ChainHead[链头] --> Seeds
        Recent[最近 5 条消息] --> Seeds
        ContentSeeds --> Seeds
    end

    Seeds --> BFS[BFS 传播<br/>最多 3 跳]

    subgraph BFS 传播
        BFS --> Decay[每跳衰减 ×0.6]
        BFS --> Weight[边有效权重<br/>幂律衰减]
        BFS --> Noise[噪声扰动<br/>模拟突触放电]
        BFS --> Arousal[情绪加成]
        BFS --> Recalled[回忆次数加成]
    end

    Decay & Weight & Noise & Arousal & Recalled --> Activation[激活集合]
    Activation --> Lateral[侧抑制<br/>同源节点去重]
    Lateral --> TopN[取 TopN]
    TopN --> Recall[回想处理<br/>挖空 / 混淆]
    Recall --> Queue[注入队列]

    Queue --> Injection[组装 attachment]
    Injection --> Prompt[注入到 prompt]

    style Input fill:#E3F2FD,stroke:#2196F3
    style Queue fill:#E8F5E9,stroke:#4CAF50
    style Prompt fill:#FFF3E0,stroke:#FF9800
```

### 激活扩散的数学形式

从种子节点 $s$ 出发，第 $h$ 跳的激活值：

$$
\text{act}_{h+1}(t) = \text{act}_h(s) \cdot W_{\text{eff}}(e) \cdot \lambda^h \cdot \eta \cdot \beta_{\text{arousal}} \cdot \beta_{\text{recall}}
$$

其中：

- $W_{\text{eff}}(e)$ —— 边的有效权重（幂律衰减后）
- $\lambda = 0.6$ —— 每跳衰减系数
- $\eta \sim \text{jitter}$ —— 噪声扰动
- $\beta_{\text{arousal}}$ —— 情绪加成
- $\beta_{\text{recall}}$ —— 回忆频率加成

## 遗忘与衰减

遗忘不是删除，而是**边的自然衰减**。每一段记忆的强度不写在节点上，而体现在它与网络其他部分的连接强度上。

```mermaid
graph TB
    subgraph 记忆强度
        Recent["近期记忆<br/>time 边权重高"]
        Old["久远记忆<br/>time 边权重低"]
        Structural["结构性记忆<br/>fold 边恒定"]
    end

    Recent -->|"随时间<br/>幂律衰减"| Old
    Old -->|"有效权重低于阈值"| Dead[死边<br/>GC 清理]

    Structural -.->|"永不衰减"| Keep[长期保留]

    subgraph 废弃分层
        Mid["mid 节点<br/>孤岛化 → trash"]
        Long["long 节点<br/>永不删，只降权"]
        Msg["message<br/>永久保留"]
    end

    Dead -.-> Mid
    Mid -->|"宽限期 7 天"| Deleted[物理删除]
    Long -.->|"保留"| Keep
    Msg -.->|"保留"| Keep

    style Recent fill:#E8F5E9,stroke:#4CAF50
    style Old fill:#FFF3E0,stroke:#FF9800
    style Dead fill:#FFEBEE,stroke:#F44336
    style Long fill:#F3E5F5,stroke:#9C27B0
```

**幂律衰减曲线**（对比指数衰减）：

```mermaid
xychart-beta
    title "记忆强度随时间衰减"
    x-axis "天数" [0, 30, 90, 180, 365]
    y-axis "相对强度" 0 --> 1

    line "幂律 (β=0.4)" [1.0, 0.50, 0.29, 0.20, 0.14]
    line "指数 (半衰 30d)" [1.0, 0.50, 0.125, 0.016, 0.0002]
```

幂律曲线尾部更长——这就是为什么"老了还记得童年的事"，而指数衰减在半年后就把记忆压死了。

## 生物启发的机制

OverMem 不只是一个数据库，更是一次对神经机制的工程模拟。以下机制贯穿整个系统：

```mermaid
mindmap
  root((记忆模拟))
    突触传递
      突触失败
        弱边以概率被跳过
      噪声
        膜电位抖动
        放电不确定性
    突触可塑性
      走过的边加强
      未用的边削弱
      LTP / LTD
    情绪调制
      情绪词检测
      强情绪记忆优先召回
    再巩固
      被回忆次数累计
      回忆越多越易想起
    睡眠重放
      非即时批量折叠
      模拟深睡巩固
    侧抑制
      同源节点去重
      避免重复注入
```

每一项机制都对应一个真实的生物学现象，也对应一段可以调整参数的配置。

## 消息的完整生命周期

```mermaid
stateDiagram-v2
    [*] --> Pending: user 消息抵达
    Pending --> PendingAI: assistant 流式回复（覆盖）
    PendingAI --> Block: 下一轮 user 抵达时固化
    Block --> Theme: 累积 N 个事件 → AI 抽象成主题
    Block --> [*]: 保留为原始证据

    Theme --> Narrative: 累积 M 个主题 → AI 建构叙事
    Theme --> Trash: 长时间未激活
    Theme --> [*]: 保留

    Narrative --> [*]: 永久保留（只降权）

    Trash --> [*]: 宽限期后物理删除

    note right of Pending
        携带 MSG_ID
        可被编辑/重发复用
    end note

    note right of Block
        折叠为 fold 边指向源消息
        边永不衰减
    end note

    note right of Theme
        携带 meta 元数据
        keywords / 时间范围 / 情绪弧线
    end note
```

## 最新动态

Beta 0.3.0 发布！   
时隔许久，对0.2.0进行的全面修复！    
如果您在测试使用的时候有任何问题，欢迎提交 issue。   

## 安装与使用

在 Operit AI 的插件市场中安装本包后，回到主页，找到侧栏的"OverMem 记忆库"入口，点击进入完成配置即可使用。

## 开源

该项目基于 GNU General Public License v3.0 (GPL-3.0) 协议开源。
开源仓库：[https://github.com/yyswys-yjyj/com.operit.overmem](https://github.com/yyswys-yjyj/com.operit.overmem)

## Star History

![Star History Chart](https://api.star-history.com/svg?repos=yyswys-yjyj/com.operit.overmem&type=Date)

> 如果你喜欢这个项目，请到 Github 上给它一个 Star ⭐，谢谢

## Contributors

<a href="https://github.com/yyswys-yjyj/com.operit.overmem/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=yyswys-yjyj/com.operit.overmem" />
</a>