# OverMem | 旧忆重逢

> 现阶段正在编写核心代码，请耐心等待发布

<div align="center">
    <img src="https://visitor.serveryyswys.top/cnt/overmem" alt="OverMem | 旧忆重逢"></img><br>
    <i>*那些被遗忘的对话，终将再次被记起。*</i><br>
    简体中文 | <a href="./doc/README.en.md">English</a>
    <br><br>
    <a href="https://github.com/yyswys-yjyj/com.operit.overmem"><img src="https://img.shields.io/badge/GitHub-OverMem-blue?style=for-the-badge&logo=github"></img></a>
    <a href="https://git.repo.archive.serveryyswys.top/yyswys-yjyj/com.operit.overmem"><img src="https://img.shields.io/badge/Gitea-OverMem-green?style=for-the-badge&logo=gitea"></img></a>
    <img src="https://img.shields.io/badge/version-0.1.0--Alpha-orange?style=for-the-badge"></img>
    <a href="https://github.com/yyswys-yjyj/com.operit.overmem/LICENSE"><img src="https://img.shields.io/badge/License-GPL--3.0-green?style=for-the-badge"></img></a>
    <img src="https://img.shields.io/github/stars/yyswys-yjyj/com.operit.overmem?style=for-the-badge&logo=github&color=yellow"></img>
</div>
<br>

**当你和AI聊了许久，聊得久了，随着会话被压缩，AI会慢慢淡忘你们之间的点点滴滴。**   
**旧忆重逢** 是一个记忆库插件，旨在让AI记住你们的过去，助力守护着你们之间的回忆。

## 描述与架构设计
相信你在点进这个插件页面的那一刻，一定是为了寻找一个能让你和AI之间的回忆得以延续的解决方案。      
OverMem 的方案是，短期记忆快速记忆，中期记忆自动整理，长期记忆永久保存。       
这样设计，得以让AI拥有真实的记忆系统，AI可能会忘记，可能会记错，有时候还会想不出来但突然灵光一现。

### 记忆系统架构
```mermaid
graph TD
    正常对话 --> |自动收集| 短期记忆
    短期记忆 --> |自动筛选| 中期记忆
    中期记忆 --> |自动整理| 长期记忆
    中期记忆 --> |随时注入到会话（高权值）| 正常对话
    长期记忆 --> |随时注入到会话（低权值）| 正常对话
```

### 记忆与遗忘

```mermaid
graph TD
    短期记忆 --> |通过AI整理成块| 中期记忆
    中期记忆 --> |由AI根据上下文情况筛选不必要的记忆| 长期记忆
    中期记忆 --> |被筛掉的| 废弃篓
    长期记忆 --> |由AI根据上下文评估距离，并决定是否降级（遗忘系统）| 中期记忆
    长期记忆 --> |由AI评估距离并决定是否遗忘| 废弃篓
    废弃篓 --> |超低权值命中时恢复| 中期记忆
    废弃篓 --> |超过指定轮数且仍无命中| 遗忘
```

### 检索设计与记忆存储设计

```mermaid
graph TB
    subgraph 用户消息处理
        用户输入 --> 分词
        分词 --> |根据权重| 检索记忆库
        检索记忆库 --> |产生命中| 加入候选集合
    end

    subgraph 候选集合处理
        候选集合 --> |按距离与随机种子排序，产生排序结果| 产生队列
        产生队列 --> |取前N条| 最终结果
    end

    subgraph 会话注入
        最终结果 --> 注入提示词给AI
        注入提示词给AI --> AI回复
        
    end

    AI回复 --> |产生记忆，带着新一轮的User-Assistant| 存入暂存区

    subgraph 处理消息
     存入暂存区 --> |等待AI回复完成| 保存记忆块
     保存记忆块 --> 存入短期记忆
    end

    加入候选集合 --> |传递| 候选集合
```

## 安装与使用
在Operit AI的插件市场中安装本包后，回到主页，找的侧栏的“OverMem记忆库”入口，点击进入完成配置即可使用。

## 开源
该项目基于GNU General Public License v3.0(GPL-3.0)协议开源。   
开源仓库：[https://github.com/yyswys-yjyj/com.operit.overmem](https://github.com/yyswys-yjyj/com.operit.overmem)

## Star History
![Star History Chart](https://api.star-history.com/svg?repos=yyswys-yjyj/com.operit.overmem&type=Date)

> 如果你喜欢这个项目，请到Github上给它一个Star⭐，谢谢

## Contributors
<a href="https://github.com/yyswys-yjyj/com.operit.overmem/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=yyswys-yjyj/com.operit.overmem" />
</a>
