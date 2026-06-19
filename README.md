# Dino PS Plugins

> Early personal toolkit for Photoshop / UXP workflow experiments.
> 面向 Photoshop / UXP 工作流实验的个人早期工具集。
>

<p align="center">
  <img src="https://psiswordpress.oss-cn-shanghai.aliyuncs.com/dinos%20git%20small.jpg" alt="Dino PS Plugins preview" width="600">
</p>



## 中文说明

### 项目定位

**Dino PS Plugins** 是一个面向 ACG / 游戏美术资产制作流程的 Photoshop / UXP 插件作品集。

这个仓库用于整理我个人构筑的 Photoshop 工具方法论，把传统 ACG 作画与游戏美术生产中的重复操作逐步工具化，例如图层快速定位、保护式手动清理、飞笔检查、图层批量整理、临时合并与流程辅助等。

这个仓库也是我的个人测试场。这里提供的插件不保证稳定可用，功能、结构和接口都可能随时修改；我会在这里记录实验过程、迭代结果和逐步成型的工具想法。

当前项目处于 **early personal toolkit / work in progress** 阶段。插件会先以小型、可验证、可迭代的方式推进，优先解决真实绘制流程里频繁打断注意力的小问题。

### 项目缘起

建立这个仓库并开始涉足 AI 开发的最初动机，来自于我的挚友世怪螺像在 2025 年 8 月发表的一篇微博。以下是节选：

> “我参加过许多AI和Tech的活动，几乎每次主讲人都会强调，我们不是要取代人而是帮助人，然而这与大多数人朴素的认知不符；我们就是在结结实实的被替代。所以我想，也许事情并非如此，我们是会被替代的，然而我们仍然可以付出更大的努力去帮助更多的人一起渡过难关，并且将技术以更加人本的方式引入到我们的生活中。”

而在我的实际体验中，我也会察觉到，技术语言的被垄断，正在围猎创意工作者的正当权益。由此，我开始了这个项目。

我所希望的技术发展形态，是减轻人在创作过程中被无意义劳动所折磨的痛苦，同时避免我们被不了解的人以不合适的方式定价、命名。这里是我理解和掌握技术的起点，也希望它的部分成果能切实“让创作变得更轻松”。

**创作不应该是一件必须忍耐的事情。**

### 为什么做这个工具集

ACG 与游戏美术资产制作中，很多时间并不是花在真正的判断和绘制上，而是消耗在重复查找、切换、整理、确认和清理上。

这个项目希望把这些重复动作沉淀成轻量插件，让 Photoshop 更贴近个人创作习惯：

- 减少在大型图层文件中反复寻找目标图层的时间。
- 在清理线稿、飞笔、误触笔画时保留人工判断权。
- 让批量整理和临时合并更可控、更容易回退。
- 把个人流程经验整理为可复用、可发布、可维护的小工具。

### 当前插件列表

| 插件 | 路径 | 状态 | 说明 |
| --- | --- | --- | --- |
| Layer Locator / 图层快速定位 | `plugins/layer-quick-jump/` | `0.2.0 beta` | 保存三个图层锚点，可快速跳转、清除记录，或把当前所选图层转移到锚点下方。 |
| Layer Quick Jump CEP | `plugins/layer-quick-jump-cep/` | `0.1.0 experiment` | 同一工具思路的 CEP 兼容性实验实现，用于源码存档和旧扩展运行时测试。 |
| Stray Stroke Cleaner / 飞笔清理辅助 | `plugins/stray-stroke-cleaner/` | Prototype | 用于探索飞笔检查与保护式清理流程的早期面板原型。 |

> Note: `layer-quick-jump` will be organized as the first formal plugin module under the Layer Locator direction.
> 说明：`layer-quick-jump` 将作为 Layer Locator / 图层快速定位方向的第一个正式插件模块继续整理。

### Roadmap

- **Phase 1: Layer Locator / 图层快速定位**
  快速保存、定位和跳转到常用图层或图层组，减少大型 PSD 中的图层查找成本。

- **Phase 2: Guarded Manual Cleanup / 保护式手动清理**
  围绕人工确认、非破坏式标记、清理前后对照，构建更安全的线稿或图像清理辅助工具。

- **Phase 3: Stray Stroke Detector / 飞笔检查**
  探索针对误触笔画、孤立笔画、异常小形状或清理遗漏的检测与提示流程。

### 安全与版权边界

这个仓库只包含个人业余项目代码、文档和合成示例资源。

本仓库不会包含：

- 任何公司代码、公司素材、公司截图或公司内部资料。
- 任何公司项目名、内部路径、业务信息或未公开命名。
- 任何账号、密码、token、API key、密钥或登录凭据。
- 任何未获授权的商业素材、真实项目 PSD/PSB 文件或大型个人测试素材。
- `node_modules/`、缓存、临时文件、系统文件或本地环境配置。

如果将来需要展示效果图，优先使用合成测试素材、手工制作的示例文件或明确可公开的个人作品片段。

### 当前状态

这是一个早期个人工具集，API、目录结构、插件命名和发布流程都可能继续调整。

---

## English

### Project Positioning

**Dino PS Plugins** is a personal Photoshop / UXP plugin portfolio focused on ACG and game-art asset production workflows.

The repository collects a personal Photoshop tool methodology and turns repetitive operations in traditional ACG drawing and game-art production into focused UXP plugins, including layer locating, guarded manual cleanup, stray-stroke inspection, batch layer organization, temporary merging, and other production helpers.

This repository is also my personal testing ground. Plugins here are not guaranteed to be stable or production-ready; features, structure, and interfaces may change at any time as I document experiments, iterations, and emerging tool ideas.

The project is currently an **early personal toolkit / work in progress**. Plugins will start small, stay practical, and evolve through testing in real drawing and asset-preparation workflows.

### Project Origin

The original motivation for creating this repository and beginning to explore AI-assisted development came from a Weibo post published by my close friend 世怪螺像 in August 2025. The following is an excerpt:

> "I have attended many AI and tech events, and at nearly every one, the speakers emphasize that we are not trying to replace people, but to help them. Yet this conflicts with what most people plainly perceive: we are, in very real terms, being replaced. So I began to think that perhaps both things can be true. We may be replaced, but we can still make a greater effort to help more people through difficult times, and bring technology into our lives in a more human-centered way."

In my own experience, I have also felt that the monopolization of technical language is encroaching on the legitimate rights and interests of creative workers. This is where the project began.

The form of technological development I hope for should reduce the pain of meaningless labor in the creative process, while helping us avoid being priced and defined in inappropriate ways by people who do not understand our work. This repository is my starting point for understanding and gaining command of technology, and I hope some of its results can genuinely make creation easier.

**Creating should not be something we simply have to endure.**

### Why This Exists

In ACG illustration and game-art production, a surprising amount of time is spent not on creative decisions, but on repeated searching, switching, organizing, checking, and cleanup.

This project aims to turn those repeated actions into lightweight tools:

- Reduce the time spent finding target layers in large Photoshop documents.
- Keep human judgment in control during cleanup and stray-stroke review.
- Make batch organization and temporary merging safer and easier to reverse.
- Document personal workflow knowledge as reusable, maintainable, public tools.

### Current Plugins

| Plugin | Path | Status | Description |
| --- | --- | --- | --- |
| Layer Locator | `plugins/layer-quick-jump/` | `0.2.0 beta` | Saves three layer anchors for jumping, clearing, or moving the current selection below an anchor. |
| Layer Quick Jump CEP | `plugins/layer-quick-jump-cep/` | `0.1.0 experiment` | CEP compatibility experiment of the same tool idea, archived for source access and legacy runtime testing. |
| Stray Stroke Cleaner | `plugins/stray-stroke-cleaner/` | Prototype | Early panel prototype for exploring stray-stroke review and guarded cleanup workflows. |

> Note: `layer-quick-jump` is the first plugin module in the Layer Locator direction and may be reorganized under a cleaner module name later.

### Roadmap

- **Phase 1: Layer Locator**
  Save and jump to frequently used layers or layer groups in large Photoshop documents.

- **Phase 2: Guarded Manual Cleanup**
  Build safer cleanup workflows around manual confirmation, non-destructive marks, and before/after review.

- **Phase 3: Stray Stroke Detector**
  Explore detection and review flows for accidental strokes, isolated marks, tiny artifacts, and cleanup leftovers.

### Safety And Copyright Boundary

This repository only contains personal hobby-project code, documentation, and synthetic example assets.

This repository must not include:

- Company code, company assets, company screenshots, or internal company materials.
- Company project names, internal paths, business information, or unreleased internal naming.
- Accounts, passwords, tokens, API keys, secrets, or login credentials.
- Unauthorized commercial assets, real production PSD/PSB files, or large personal test assets.
- `node_modules/`, caches, temporary files, system files, or local environment configuration.

Future screenshots or demos should use synthetic test assets, handmade examples, or clearly public personal artwork snippets.

### Current Status

This is an early personal toolkit. APIs, folder structure, plugin names, and release workflow may continue to change.

## 发布规则

源码是本仓库最重要的开源与存档内容。只要插件源码、清单、说明和必要脚本完整，就可以提交到仓库。

`.ccx`、`.zip`、CEP 测试包等属于可选发布产物，按实际可用性和测试结果决定是否提供，不要求每次提交同时具备所有形式。

CCX 文件统一命名为 `Dino-<插件名>_<宿主>.ccx`，例如 `Dino-layer-quick-jump_PS.ccx`。

当前安装实验结论见 [docs/install-findings.md](docs/install-findings.md)。已确认可用的安装包可以放入版本化的 `releases/` 目录；尚未验证的实现应明确标注为 beta、prototype 或 experiment。

## 许可证

本项目使用 Apache License 2.0 开源许可证。

你可以自由使用、修改、分发本项目，也可以用于商业场景；但需要保留原始版权声明和许可证文本，并在分发修改版本时说明你做过哪些改动。

本项目按“现状”提供，不提供任何明示或暗示担保。

## License

This project is licensed under the Apache License 2.0.

You are free to use, modify, distribute, and use this project commercially, as long as you preserve the copyright notice and license text, and clearly state any changes you make.

This project is provided as-is, without warranty.
