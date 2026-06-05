---
title: 大项目设计：GeekEdu 在线知识付费平台
categories:
  - 项目设计
tags:
  - Go
  - Gin
  - gRPC
  - React
  - 微服务
  - OSS
  - Docker
description: 设计一个基于微服务架构的在线视频学习平台，重点解决付费内容保护、OSS 私有资源分发和服务端签名播放的问题。
cover: /posts/7cb99032/cover.png
abbrlink: 7cb99032
date: 2026-06-05 20:20:06
updated: 2026-06-05 20:20:06
---

## 项目概述

GeekEdu 是一个基于 `微服务架构` 的在线视频学习平台。系统采用前后端分离模式，核心业务难点在于：如何利用云存储 OSS 和微服务权限控制，实现“付费内容”的保护与分发。

也就是说：未付费用户无法获取视频资源；已付费用户也只能获得有时效性的播放权限。

## 技术栈

服务端：

- Go
- Gin
- gRPC
- GORM
- JWT

前端：

- React
- Ant Design
- Axios

存储：

- MySQL
- 阿里云 OSS

运维：

- Docker
- Docker Compose

## 环境准备

在开始写代码之前，需要先完成阿里云 OSS 的开通与配置。本项目会使用对象存储服务存放课程视频和课程封面。

### 阿里云 OSS 开通与配置

1. 注册或登录阿里云账号，访问 [aliyun.com](https://www.aliyun.com/)。
2. 在控制台搜索 `OSS`，开通对象存储服务。
3. 创建 Bucket。

Bucket 配置建议：

- `Bucket Name`：使用全局唯一名称，例如 `geekedu-yourname`
- `地域 Region`：选择距离你最近的地域，例如华东 1 杭州
- `读写权限 ACL`：必须选择 `私有 Private`

私有 Bucket 是本项目的关键配置。这样未授权用户不能直接通过 OSS 原始地址访问视频资源。

### AccessKey 配置

为了让代码访问 OSS，需要准备：

- AccessKey ID
- AccessKey Secret

推荐使用 RAM 访问控制创建子用户，并授予 OSS 相关权限。

注意：实际生产环境中，AccessKey 和 Secret 不能提交到公开 Git 仓库。本项目代码也应支持从配置文件或环境变量读取敏感配置。

## 项目目录结构

为了便于统一管理，项目目录建议严格遵守以下结构：

```text
geekedu-project/
├── web-server/              # Web 接口服务，Gin + JWT
├── logic-server/            # 业务逻辑服务，gRPC
├── common/                  # 公共组件，Tools、Config、JWT
├── proto/                   # .proto 定义文件
├── frontend/                # 前端代码
│   ├── src/
│   ├── package.json
│   └── Dockerfile
├── deploy/                  # 部署与运维配置
│   ├── docker-compose.yaml
│   ├── mysql/
│   │   └── init.sql
│   └── nginx/
│       └── nginx.conf
└── README.md
```

## 系统架构设计

为了降低开发复杂度，后端拆分为两个核心服务。系统运行时共需要启动四个容器：

1. `frontend`：运行 Nginx，托管构建后的 React 静态资源。
2. `web-server`：基于 Gin，作为 HTTP 流量入口，负责请求解析、路由转发和 JWT 鉴权。
3. `logic-server`：基于 gRPC，负责用户、课程、订单、OSS 交互和数据库读写。
4. `mysql`：基础设施容器，提供数据存储。

核心链路可以理解为：

```text
Browser
  -> Frontend
  -> Web Server
  -> Logic Server
  -> MySQL
  -> Aliyun OSS
```

## 功能需求

### 用户角色

系统包含两种角色：

- 普通学员 Student
- 管理员 Admin

### 认证模块

- 支持账号密码注册和登录。
- 登录成功后签发 JWT。
- 除登录、注册、课程列表外，其余接口均需要验证 Token。

### 课程管理

讲师端需要支持：

- 发布课程：填写课程标题、价格和简介，上传封面图到 OSS。
- 上传课程视频：一个课程可以包含多个视频。
- 大文件上传：视频文件较大时，需要使用阿里云 OSS 的分片上传能力。
- 直连上传：前端通过后端生成的鉴权 URL 上传文件到 OSS。

### 课程展示与购买

学员端需要支持：

- 课程列表公开展示。
- 课程封面使用 OSS 签名链接展示。
- 模拟购买课程：点击购买后，通过 API 写入订单状态，无需对接真实支付。

### 内容消费与播放

这是项目的核心考核点。

播放鉴权流程：

1. 学员请求播放某个视频。
2. 后端校验该学员是否已经购买对应课程。
3. 如果已购买，后端调用 OSS SDK 生成 `Presigned URL`。
4. 签名 URL 有效期设置为 3600 秒。
5. 前端拿到签名 URL 后，通过播放器播放视频。
6. 如果用户直接访问 OSS 原始地址，应返回 `Access Denied`。

## API 设计参考

建议 Web Server 采用 RESTful 风格设计接口。

| 方法 | 路径 | 描述 | 备注 |
| --- | --- | --- | --- |
| POST | `/api/v1/auth/login` | 用户登录 | 返回 JWT |
| GET | `/api/v1/courses` | 获取课程列表 | 公开接口 |
| POST | `/api/v1/courses` | 发布课程 | 需要讲师权限，Form-data，包含封面图 |
| POST | `/api/v1/courses/:id/videos` | 上传视频 | Form-data，大文件上传 |
| POST | `/api/v1/orders` | 购买课程 | 请求体包含 `course_id` |
| GET | `/api/v1/player/:video_id` | 获取播放地址 | 返回带签名的 OSS URL |

## 系统设计文档要求

项目需要提交一份 Markdown 格式的系统设计文档，文件名建议为 `system-design.md`。

文档必须包含：

- 系统架构图：展示 Frontend、Web Server、Logic Server、MySQL、OSS 之间的交互关系与数据流向。
- 接口设计文档：定义前后端交互 API，包括 URL、Method、Request Body、Response Body。
- 数据库设计：包含建表 SQL、索引、主键和外键设计。

## 开发实施步骤

### 第一阶段：后端服务

1. 编写 `.proto` 文件，定义 Web Server 与 Logic Server 之间的 RPC 接口。
2. 实现配置管理，支持从配置文件或环境变量读取 AccessKey、SecretKey、DB Password、Host、Port 等配置。
3. 实现 Logic Server。
4. 集成阿里云 OSS SDK，实现文件上传和签名 URL 生成。
5. 连接 MySQL 数据库。
6. 使用 Gin 搭建 Web Server。
7. 在 Web Server 中连接 Logic Server 的 gRPC 接口。
8. 实现路由和 JWT 鉴权中间件。

### 第二阶段：前端开发

1. 使用 Vite 创建 React 项目，并放在 `frontend` 目录下。
2. 引入 Ant Design，完成登录页和课程列表页。
3. 使用 `react-player` 或 HTML5 `<video>` 标签实现播放器。
4. 只有当后端返回 200 和签名 URL 时，前端才渲染播放器。

### 第三阶段：容器化与联调

需要为 Web Server、Logic Server 和 Frontend 分别编写 Dockerfile，并使用 Docker Compose 编排所有服务。

示例 `deploy/docker-compose.yaml`：

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: geekedu
    volumes:
      - ./mysql/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "3306:3306"

  logic-server:
    build: ../logic-server
    environment:
      OSS_ACCESS_KEY: ${OSS_ACCESS_KEY}
      OSS_SECRET_KEY: ${OSS_SECRET_KEY}
      OSS_ENDPOINT: "oss-cn-hangzhou.aliyuncs.com"
      OSS_BUCKET: "my-bucket-name"
      DB_HOST: mysql
    depends_on:
      - mysql

  web-server:
    build: ../web-server
    ports:
      - "8080:8080"
    depends_on:
      - logic-server

  frontend:
    build: ../frontend
    ports:
      - "80:80"
```

启动方式：

```bash
cd deploy
docker-compose up --build
```

## 主要考核点

- 功能完善，符合需求说明。
- 代码结构清晰，具备合理注释和可扩展性。
- 错误处理完善，不能直接 `panic`，需要统一错误码返回。
- 配置文件管理规范，不能硬编码 AccessKey 和 SecretKey。
- OSS Bucket 使用私有权限。
- 视频播放通过服务端签名 URL 授权访问。
- OSS Key、Secret 等配置支持环境变量或配置文件注入。

## 提交物

最终提交内容建议包括：

1. `system-design.md`：包含架构图、接口文档、数据库设计和 OSS 配置截图。
2. 完整源码：包含 `web-server`、`logic-server`、`frontend`、`deploy` 等目录。
3. `README.md`：说明如何配置 OSS Key，以及如何启动项目。
4. `project.mp4`：录制演示视频。

演示视频需要包含：

- 启动演示：展示 `docker-compose up` 一键启动过程。
- 功能演示：完整演示注册、登录、发布课程、购买、播放等核心流程。
- 亮点展示：讲解代码设计亮点或附加功能实现。

## 总结

GeekEdu 的核心不是简单地做一个课程展示页面，而是围绕“付费内容如何安全分发”展开系统设计。通过私有 OSS Bucket、服务端签名 URL、JWT 鉴权、订单校验和微服务拆分，可以建立一个比较完整的在线知识付费平台雏形。
