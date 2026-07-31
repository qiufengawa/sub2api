<div align="center">

<img src="assets/logo.svg" alt="Sub2API Logo" width="128" />

# Sub2API UI 发行分支

**由 `qiufengawa/sub2api` 独立构建、发布和更新的 Sub2API 发行版**

[![Release](https://img.shields.io/github/v/release/qiufengawa/sub2api?label=%E7%A8%B3%E5%AE%9A%E7%89%88)](https://github.com/qiufengawa/sub2api/releases/latest)
[![CI](https://github.com/qiufengawa/sub2api/actions/workflows/ci.yml/badge.svg?branch=ui%2Fmain)](https://github.com/qiufengawa/sub2api/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/qiufengawa/sub2api)](LICENSE)

[下载最新版](https://github.com/qiufengawa/sub2api/releases/latest) · [安装说明](deploy/README.md) · [上游项目](https://github.com/Wei-Shaw/sub2api)

</div>

## 这是哪个版本？

这是基于 [Wei-Shaw/sub2api](https://github.com/Wei-Shaw/sub2api) 维护的独立发行分支。

本分支保留 Sub2API 原有功能，重点维护自己的前端版本与完整发行链路：从本仓库安装，就会继续从本仓库检查更新、下载新版本和执行回滚，不再跳回上游仓库。

历史版本 [`v1.0.0`](https://github.com/qiufengawa/sub2api/releases/tag/v1.0.0) 完成了独立发行源的建立。当前源码版本为 `v0.1.168-qiu.3`，版本号会同时记录上游基线与本发行分支的迭代序号。

## 本分支带来了什么？

| 项目 | 本分支设置 |
| --- | --- |
| 默认发行分支 | `ui/main` |
| 稳定版本 | `qiufengawa/sub2api` 的 GitHub Releases |
| 一键安装源 | `qiufengawa/sub2api/ui/main` |
| 后台在线更新 | 检查 `qiufengawa/sub2api` 的最新稳定 Release |
| 后台回滚 | 下载本仓库已发布的历史版本 |
| Docker 镜像 | `ghcr.io/qiufengawa/sub2api` |
| 页面内 GitHub 链接 | 指向 `qiufengawa/sub2api` |
| 上游同步分支 | `main`，保持上游原始代码，不放自定义 UI |

这套结构解决了两个问题：

- 用户通过你的链接安装后，后续更新仍然来自你的版本；
- 同步上游代码时，自定义 UI 留在 `ui/main`，不会污染用于跟踪上游的 `main`。

## 快速安装

### Linux 二进制安装

适用于 `amd64` 和 `arm64` Linux。安装前需要可用的 PostgreSQL 15+、Redis 7+ 和 root 权限。

```bash
curl -sSL https://raw.githubusercontent.com/qiufengawa/sub2api/ui/main/deploy/install.sh | sudo bash
```

安装完成后访问：

```text
http://服务器IP:8080
```

首次启动按照页面向导配置数据库、Redis 和管理员账户。

### Docker Compose

Docker 方式会准备 Sub2API、PostgreSQL 和 Redis 的 Compose 配置：

```bash
mkdir -p sub2api-deploy && cd sub2api-deploy
curl -sSL https://raw.githubusercontent.com/qiufengawa/sub2api/ui/main/deploy/docker-deploy.sh | bash
docker compose up -d
```

查看运行日志：

```bash
docker compose logs -f sub2api
```

直接拉取镜像：

```bash
docker pull ghcr.io/qiufengawa/sub2api:latest
```

如需固定版本，使用明确的版本标签，避免 `latest` 自动变化：

```bash
docker pull ghcr.io/qiufengawa/sub2api:0.1.168-qiu.3
```

更完整的部署、备份和迁移说明见 [deploy/README.md](deploy/README.md)。Apple 芯片 Mac 可参考 [Apple Container 安装说明](deploy/APPLE_CONTAINER.md)。

## 下载已发布版本

所有预编译程序、校验文件和版本说明统一发布在：

<https://github.com/qiufengawa/sub2api/releases>

安装脚本会自动识别系统架构并下载合适的稳定版本。需要固定版本时，可以给安装脚本传入版本号：

```bash
curl -sSL https://raw.githubusercontent.com/qiufengawa/sub2api/ui/main/deploy/install.sh | sudo bash -s -- --version v0.1.168-qiu.3
```

## 更新与回滚

### 二进制安装

管理员登录后台后，可以通过版本入口检查更新。本分支的后台更新服务只读取：

```text
https://github.com/qiufengawa/sub2api/releases
```

检测到新稳定版后，可在后台完成下载、安装和重启；需要回退时，历史版本与下载文件同样来自本仓库。

### Docker 安装

使用最新版：

```bash
docker compose pull
docker compose up -d
```

生产环境建议在 Compose 文件中固定具体版本，例如：

```yaml
image: ghcr.io/qiufengawa/sub2api:0.1.168-qiu.3
```

升级前请先备份数据库、Redis 数据和应用数据目录。

## 分支与上游同步方案

本仓库长期使用两个分支：

| 分支 | 用途 | 是否放自定义 UI |
| --- | --- | --- |
| `main` | 跟踪 `Wei-Shaw/sub2api` 上游代码 | 否 |
| `ui/main` | 实际安装、开发、测试与发布 | 是 |

同步上游时采用以下流程：

```text
Wei-Shaw/sub2api main
          ↓ 同步
本仓库 main
          ↓ 合并并解决冲突
本仓库 ui/main
          ↓ CI 通过后打标签
GitHub Release + GHCR 镜像
```

这样做的原则是：

- `main` 始终作为干净的上游镜像，便于判断上游新增了什么；
- 自定义 UI 和发行设置只进入 `ui/main`；
- 上游更新合入 `ui/main` 时，只处理真实冲突，不覆盖自己的 UI；
- 每次正式发布都使用版本标签，并在 CI 全部通过后生成 Release。

## 版本规则

本分支固定使用以下格式：

```text
v<上游官方版本>-qiu.<迭代序号>
```

例如 `v0.1.168-qiu.3` 表示：

- 上游基线为 `Wei-Shaw/sub2api v0.1.168`；
- 这是本发行分支基于该上游版本发布的第 3 个迭代版本。

版本递增规则：

- 每次发布本分支的新迭代时递增 `qiu.N`，例如 `v0.1.168-qiu.2` → `v0.1.168-qiu.3`；
- 同步到新的上游版本时更新前半段，`qiu.N` 继续作为本分支发行序号递增，例如 `v0.1.168-qiu.3` → `v0.1.169-qiu.4`；
- 每个 Release 的说明必须分别列出“同步的上游内容”和“本分支改动”。

历史标签 `v1.0.0` 以及曾使用的 `v<上游版本>-v<发行版本>` 格式继续由更新与回滚逻辑识别。`-qiu.N` 在语义化版本工具中属于预发布形态，本仓库通过 GoReleaser 明确将其发布为正式 Release，因此后台更新、安装脚本和 `latest` 镜像会继续跟踪稳定版本。

## 说明

- 本仓库是独立维护的 Fork，不代表上游作者为本分支的修改、构建与发行提供支持。
- Sub2API 的完整产品能力和接口说明以上游代码及本仓库实际版本为准；本 README 只介绍本发行分支与上游不同的部分。
- 使用前请自行确认相关服务条款以及所在地法律法规，并妥善保护数据库密码、API Key、JWT 和 TOTP 密钥。

## 许可与上游

本项目沿用 [GNU Lesser General Public License v3.0 或更高版本](LICENSE)。

上游项目：<https://github.com/Wei-Shaw/sub2api>

本发行仓库：<https://github.com/qiufengawa/sub2api>
