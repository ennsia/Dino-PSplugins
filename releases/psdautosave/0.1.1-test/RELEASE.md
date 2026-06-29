# psdautosave 0.1.1-test

测试中版本。此版本用于验证绑定目标 PSD/PSB 的自动备份工作流。

## 状态

- 阶段：test build / 测试中
- 宿主：Photoshop 2025-era UXP, PS 25.0+
- 安装包：`Dino-psdautosave_PS.ccx`
- 离线包：`psdautosave-v0.1.1-offline.zip`

## 已验证

- 可选择统一备份目录。
- 可绑定当前 PSD/PSB 作为备份目标。
- 自动备份只保存绑定目标，不跟随临时 active PSD。
- 已验证在绑定 PSD 非当前主窗口时，仍可生成绑定文件的 save-as-copy 备份。
- 备份文件命名使用 `__autosave__YYYYMMDD_HHMMSS`。
- 文件名冲突时追加序号，不覆盖已有备份。
- 本版本不会自动删除任何备份文件。

## UI 调整

- 移除 10 分钟测试档。
- 将运行计时移动到标题区域。
- 缩小字体、按钮高度和面板间距。
- 保留更低的面板最小尺寸和纵向滚动。

## 回滚

如果此测试版本有问题，可回到本地保留的旧包：

```text
dist/psdautosave/0.1.0/Dino-psdautosave_PS.ccx
```

