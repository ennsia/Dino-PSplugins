# Layer Quick Jump 安装说明

## 推荐安装：CCX

1. 解压 `layer-quick-jump-v0.2.0-offline.zip`。
2. 退出 Photoshop。
3. 双击 `INSTALL_CCX.command`，或直接双击包内的 `Dino-layer-quick-jump_PS.ccx`。
4. 在 Adobe 安装窗口中确认。
5. 重新打开 Photoshop，在 Plugins 菜单里打开 Layer Quick Jump。

2026-06-19 已确认 CCX 可被 Adobe UPI 安装并注册到 Photoshop 2025。插件运行时不需要联网。

## 开发者备用：UXP Developer Tool

普通用户不优先使用这个方式，因为 UXP Developer Tool 自身可能要求 Creative Cloud 登录或邮箱验证。

1. 解压 `layer-quick-jump-v0.2.0-offline.zip`。
2. 打开 Adobe UXP Developer Tool。
3. 点击 Add Plugin。
4. 选择解压出来的 `layer-quick-jump` 文件夹。
5. 点击 Load。
6. 打开 Photoshop，在 Plugins 菜单里找到并打开插件面板。

## 注意事项

- 不要拆散插件文件夹，`manifest.json` 必须保留在插件文件夹根目录。
- 插件运行时不下载网络资源。
- 记录点保存在用户本机的插件面板存储里。
- `INSTALL_LOCAL.command` 和 `INSTALL_SYSTEM.command` 是诊断脚本；裸目录复制已测试为不显示，不是推荐安装方式。
- 安装升级版本后需要重启 Photoshop。
