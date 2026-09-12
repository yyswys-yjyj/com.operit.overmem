# OverMem | Reunion of Old Memories

> Core code is currently being written, please wait patiently for the release.

<div align="center">
    <img src="https://visitor.serveryyswys.top/cnt/overmem" alt="OverMem | Reunion of Old Memories"></img><br>
    <i>*Those forgotten dialogues will eventually be remembered again.*</i><br>
    <a href="../README.md">简体中文</a> | English
    <br><br>
    <a href="https://github.com/yyswys-yjyj/com.operit.overmem"><img src="https://img.shields.io/badge/GitHub-OverMem-blue?style=for-the-badge&logo=github"></img></a>
    <a href="https://git.repo.archive.serveryyswys.top/yyswys-yjyj/com.operit.overmem"><img src="https://img.shields.io/badge/Gitea-OverMem-green?style=for-the-badge&logo=gitea"></img></a>
    <img src="https://img.shields.io/badge/version-0.1.0--Alpha-orange?style=for-the-badge"></img>
    <a href="https://github.com/yyswys-yjyj/com.operit.overmem/LICENSE"><img src="https://img.shields.io/badge/License-GPL--3.0-green?style=for-the-badge"></img></a>
    <img src="https://img.shields.io/github/stars/yyswys-yjyj/com.operit.overmem?style=for-the-badge&logo=github&color=yellow"></img>
</div>
<br>

**When you chat with an AI for a long time, as the conversation gets compressed, the AI will gradually forget the little moments between you.**  
**Reunion of Old Memories** is a memory bank plugin designed to help the AI remember your past and guard the memories you share.

## Description & Architecture Design
The moment you clicked into this plugin page, you were surely looking for a way to keep the memories between you and your AI alive.  
OverMem's approach is: short‑term memory for rapid recall, medium‑term memory for automatic consolidation, and long‑term memory for permanent storage.  
This design gives the AI a realistic memory system — it may forget, misremember, sometimes draw a blank, and then suddenly have a flash of insight.

### Memory System Architecture
```mermaid
graph TD
    normal_conversation[Normal Conversation] --> |Auto‑collect| short_term[Short‑term Memory]
    short_term --> |Auto‑filter| medium_term[Medium‑term Memory]
    medium_term --> |Auto‑consolidate| long_term[Long‑term Memory]
    medium_term --> |Inject into session anytime, high weight| normal_conversation
    long_term --> |Inject into session anytime, low weight| normal_conversation
```

### Memory & Forgetting

```mermaid
graph TD
    short_term[Short‑term Memory] --> |Consolidated into chunks by AI| medium_term[Medium‑term Memory]
    medium_term --> |AI filters unnecessary memories based on context| long_term[Long‑term Memory]
    medium_term --> |Filtered out| waste_basket[Waste Basket]
    long_term --> |AI evaluates relevance and decides whether to downgrade - Forgetting System| medium_term
    long_term --> |AI evaluates relevance and decides whether to forget| waste_basket
    waste_basket --> |Restored when hit with very low weight| medium_term
    waste_basket --> |No hit after specified rounds| forgotten[Forgotten]
```

### Retrieval Design & Memory Storage Design

```mermaid
graph TB
    subgraph User Message Processing
        user_input[User Input] --> tokenize[Tokenization]
        tokenize --> |By weight| search[Search Memory Bank]
        search --> |Produces hits| add_to_candidate[Add to Candidate Set]
    end

    subgraph Candidate Set Processing
        candidate_set[Candidate Set] --> |Sort by distance & random seed, produce ranking| generate_queue[Generate Queue]
        generate_queue --> |Take top N| final_result[Final Result]
    end

    subgraph Session Injection
        final_result --> inject[Inject into Prompt for AI]
        inject --> ai_reply[AI Reply]
    end

    ai_reply --> |Generates memory, with new User‑Assistant turn| store_temp[Store in Staging Area]

    subgraph Message Processing
        store_temp --> |Wait for AI reply to finish| save_block[Save Memory Block]
        save_block --> store_short[Store in Short‑term Memory]
    end

    add_to_candidate --> |Pass| candidate_set
```

## Installation & Usage
After installing this package from the plugin marketplace in Operit AI, return to the main page, find the "OverMem Memory Bank" entry in the sidebar, click it and complete the configuration to start using.

## Open Source
This project is open‑sourced under the GNU General Public License v3.0 (GPL‑3.0).  
Open‑source repository: [https://github.com/yyswys-yjyj/com.operit.overmem](https://github.com/yyswys-yjyj/com.operit.overmem)

## Star History
![Star History Chart](https://api.star-history.com/svg?repos=yyswys-yjyj/com.operit.overmem&type=Date)

> If you like this project, please give it a Star⭐ on GitHub. Thank you!

## Contributors
<a href="https://github.com/yyswys-yjyj/com.operit.overmem/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=yyswys-yjyj/com.operit.overmem" />
</a>
