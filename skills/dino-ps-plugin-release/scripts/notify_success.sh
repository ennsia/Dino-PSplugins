#!/bin/zsh
set -euo pipefail

RELEASE_NAME="${1:-Dino Photoshop plugin}"

osascript -e "display notification \"GitHub 推送与远端校验成功\" with title \"Dino 插件已发布\" subtitle \"$RELEASE_NAME\""
