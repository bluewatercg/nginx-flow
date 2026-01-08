# Deployment Guide / 部署指南

[English](#english) | [中文](#中文)

---

<a name="中文"></a>
## 中文文档

### 📋 目录

- [环境要求](#环境要求)
- [本地开发部署](#本地开发部署)
- [生产环境构建](#生产环境构建)
- [Docker 部署](#docker-部署)
- [Nginx 部署](#nginx-部署)
- [云平台部署](#云平台部署)
- [CI/CD 自动化部署](#cicd-自动化部署)
- [常见问题](#常见问题)

---

### 环境要求

| 依赖 | 最低版本 | 推荐版本 |
|-----|---------|---------|
| Node.js | 18.0.0 | 20.x LTS |
| npm | 8.0.0 | 10.x |
| pnpm (可选) | 8.0.0 | 9.x |

**检查环境：**

```bash
node --version  # 应显示 v18.x.x 或更高
npm --version   # 应显示 8.x.x 或更高
```

---

### 本地开发部署

#### 1. 克隆项目

```bash
# 从 GitHub 克隆
git clone https://github.com/your-username/nginx-config-visual-editor.git

# 进入项目目录
cd nginx-config-visual-editor
```

#### 2. 安装依赖

```bash
# 使用 npm
npm install

# 或使用 pnpm（更快）
pnpm install
```

#### 3. 启动开发服务器

```bash
npm run dev
```

开发服务器将在 `http://localhost:5173` 启动，支持热更新。

#### 4. 开发模式特性

- ⚡ **热模块替换 (HMR)** - 代码修改实时生效
- 🔍 **源码映射** - 方便调试
- 📝 **TypeScript 检查** - 实时类型检查

---

### 生产环境构建

#### 1. 构建生产版本

```bash
npm run build
```

构建产物将输出到 `dist/` 目录。

#### 2. 本地预览生产版本

```bash
npm run preview
```

预览服务器将在 `http://localhost:4173` 启动。

#### 3. 构建产物结构

```
dist/
├── index.html          # 入口 HTML
├── assets/
│   ├── index-[hash].js    # 主 JS 包
│   ├── index-[hash].css   # 主 CSS 包
│   └── vendor-[hash].js   # 第三方库
├── favicon.ico
└── robots.txt
```

---

### Docker 部署

#### 方式一：使用预构建镜像

**1. 创建 Dockerfile**

```dockerfile
# 构建阶段
FROM node:20-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 安装依赖
RUN npm ci --legacy-peer-deps

# 复制源代码
COPY . .

# 构建生产版本
RUN npm run build

# 运行阶段
FROM nginx:alpine

# 复制构建产物到 Nginx 目录
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 Nginx 配置（处理 SPA 路由）
COPY nginx.docker.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

# 启动 Nginx
CMD ["nginx", "-g", "daemon off;"]
```

**2. 创建 Nginx 配置文件 `nginx.docker.conf`**

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # SPA 路由处理
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

**3. 构建并运行 Docker 镜像**

```bash
# 构建镜像
docker build -t nginx-config-editor .

# 运行容器
docker run -d -p 8080:80 --name nginx-editor nginx-config-editor

# 访问 http://localhost:8080
```

#### 方式二：使用 Docker Compose

**创建 `docker-compose.yml`**

```yaml
version: '3.8'

services:
  nginx-config-editor:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8080:80"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/"]
      interval: 30s
      timeout: 10s
      retries: 3
```

**启动服务：**

```bash
# 启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止
docker-compose down
```

---

### Nginx 部署

#### 1. 上传构建产物

```bash
# 本地构建
npm run build

# 上传到服务器
scp -r dist/* user@your-server:/var/www/nginx-editor/
```

#### 2. 配置 Nginx 站点

**创建配置文件 `/etc/nginx/sites-available/nginx-editor`**

```nginx
server {
    listen 80;
    server_name editor.example.com;
    
    # 强制 HTTPS（推荐）
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name editor.example.com;

    # SSL 证书
    ssl_certificate /etc/letsencrypt/live/editor.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/editor.example.com/privkey.pem;
    
    # SSL 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    root /var/www/nginx-editor;
    index index.html;

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    # 静态资源长期缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # HTML 不缓存（确保更新生效）
    location ~* \.html$ {
        expires -1;
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }

    # SPA 路由
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # 禁止访问隐藏文件
    location ~ /\. {
        deny all;
    }
}
```

#### 3. 启用站点并重载 Nginx

```bash
# 创建软链接启用站点
sudo ln -s /etc/nginx/sites-available/nginx-editor /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

#### 4. 配置 SSL 证书（使用 Let's Encrypt）

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d editor.example.com

# 自动续期（已自动配置）
sudo certbot renew --dry-run
```

---

### 云平台部署

#### Vercel 部署

**1. 安装 Vercel CLI**

```bash
npm install -g vercel
```

**2. 部署**

```bash
# 登录
vercel login

# 部署（首次会创建项目）
vercel

# 部署到生产环境
vercel --prod
```

**3. 配置 `vercel.json`（可选）**

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

#### Netlify 部署

**1. 通过 Git 自动部署**

1. 登录 [Netlify](https://netlify.com)
2. 点击 "Add new site" → "Import an existing project"
3. 连接 GitHub 仓库
4. 配置构建设置：
   - Build command: `npm run build`
   - Publish directory: `dist`
5. 点击 "Deploy site"

**2. 配置 `netlify.toml`**

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

#### Cloudflare Pages 部署

**1. 通过 Dashboard 部署**

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 "Workers & Pages"
3. 点击 "Create application" → "Pages"
4. 连接 Git 仓库
5. 配置：
   - Framework preset: `Vite`
   - Build command: `npm run build`
   - Build output directory: `dist`

**2. 配置 `_redirects` 文件（放在 `public/` 目录）**

```
/* /index.html 200
```

#### 阿里云 OSS + CDN 部署

**1. 上传到 OSS**

```bash
# 安装 ossutil
# https://help.aliyun.com/document_detail/120075.html

# 配置凭证
ossutil config

# 上传构建产物
ossutil cp -r dist/ oss://your-bucket-name/ --update
```

**2. 配置 OSS 静态网站**

1. 进入 OSS 控制台 → 选择 Bucket
2. 基础设置 → 静态页面
3. 设置默认首页：`index.html`
4. 设置 404 页面：`index.html`（支持 SPA 路由）

**3. 绑定 CDN**

1. 开通 CDN 服务
2. 添加域名，源站选择 OSS Bucket
3. 配置 HTTPS 证书
4. 配置缓存规则

---

### CI/CD 自动化部署

#### GitHub Actions

**创建 `.github/workflows/deploy.yml`**

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci --legacy-peer-deps
      
      - name: Build
        run: npm run build
      
      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - name: Download artifact
        uses: actions/download-artifact@v4
        with:
          name: dist
          path: dist/
      
      # 部署到服务器（使用 SSH）
      - name: Deploy to Server
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          source: "dist/*"
          target: "/var/www/nginx-editor"
          strip_components: 1
```

**配置 GitHub Secrets：**

1. 进入 GitHub 仓库 → Settings → Secrets and variables → Actions
2. 添加以下 Secrets：
   - `SERVER_HOST`: 服务器 IP 或域名
   - `SERVER_USER`: SSH 用户名
   - `SSH_PRIVATE_KEY`: SSH 私钥

---

### 常见问题

#### Q1: 部署后页面刷新 404

**原因**: SPA 应用的路由由前端控制，服务器需要将所有路由请求重定向到 `index.html`。

**解决方案**: 确保 Nginx 配置包含：

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

#### Q2: 静态资源加载失败

**原因**: 资源路径配置错误或 CORS 限制。

**解决方案**: 检查 `vite.config.ts` 中的 `base` 配置：

```typescript
export default defineConfig({
  base: '/', // 默认，部署在根目录
  // base: '/app/', // 如果部署在子目录
})
```

#### Q3: HTTPS 证书问题

**原因**: 证书过期或配置错误。

**解决方案**:

```bash
# 检查证书有效期
openssl x509 -in /path/to/cert.pem -noout -dates

# 使用 Certbot 续期
sudo certbot renew
```

#### Q4: Docker 容器无法启动

**原因**: 端口冲突或权限问题。

**解决方案**:

```bash
# 检查端口占用
lsof -i :8080

# 以特权模式运行（调试用）
docker run --privileged -p 8080:80 nginx-config-editor
```

#### Q5: 构建失败 - 内存不足

**原因**: Node.js 默认内存限制。

**解决方案**:

```bash
# 增加 Node.js 内存限制
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

---

### 📞 技术支持

如果在部署过程中遇到问题，请：

1. 查看 [GitHub Issues](https://github.com/your-username/nginx-config-visual-editor/issues)
2. 提交新的 Issue 描述问题

---

<a name="english"></a>
## English Documentation

### 📋 Table of Contents

- [Requirements](#requirements)
- [Local Development](#local-development)
- [Production Build](#production-build)
- [Docker Deployment](#docker-deployment)
- [Nginx Deployment](#nginx-deployment)
- [Cloud Platform Deployment](#cloud-platform-deployment)
- [CI/CD Automation](#cicd-automation)
- [FAQ](#faq)

---

### Requirements

| Dependency | Minimum Version | Recommended Version |
|------------|----------------|---------------------|
| Node.js | 18.0.0 | 20.x LTS |
| npm | 8.0.0 | 10.x |
| pnpm (optional) | 8.0.0 | 9.x |

**Check environment:**

```bash
node --version  # Should display v18.x.x or higher
npm --version   # Should display 8.x.x or higher
```

---

### Local Development

#### 1. Clone the project

```bash
# Clone from GitHub
git clone https://github.com/your-username/nginx-config-visual-editor.git

# Navigate to project directory
cd nginx-config-visual-editor
```

#### 2. Install dependencies

```bash
# Using npm
npm install

# Or using pnpm (faster)
pnpm install
```

#### 3. Start development server

```bash
npm run dev
```

Development server starts at `http://localhost:5173` with hot reload support.

#### 4. Development mode features

- ⚡ **Hot Module Replacement (HMR)** - Changes take effect instantly
- 🔍 **Source maps** - Easy debugging
- 📝 **TypeScript checking** - Real-time type checking

---

### Production Build

#### 1. Build production version

```bash
npm run build
```

Build artifacts will be output to the `dist/` directory.

#### 2. Preview production build locally

```bash
npm run preview
```

Preview server starts at `http://localhost:4173`.

#### 3. Build output structure

```
dist/
├── index.html          # Entry HTML
├── assets/
│   ├── index-[hash].js    # Main JS bundle
│   ├── index-[hash].css   # Main CSS bundle
│   └── vendor-[hash].js   # Third-party libraries
├── favicon.ico
└── robots.txt
```

---

### Docker Deployment

#### Option 1: Using Pre-built Image

**1. Create Dockerfile**

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build production version
RUN npm run build

# Runtime stage
FROM nginx:alpine

# Copy build artifacts to Nginx directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy Nginx config (handles SPA routing)
COPY nginx.docker.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
```

**2. Create Nginx config file `nginx.docker.conf`**

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    # Static asset caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

**3. Build and run Docker image**

```bash
# Build image
docker build -t nginx-config-editor .

# Run container
docker run -d -p 8080:80 --name nginx-editor nginx-config-editor

# Access http://localhost:8080
```

#### Option 2: Using Docker Compose

**Create `docker-compose.yml`**

```yaml
version: '3.8'

services:
  nginx-config-editor:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8080:80"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/"]
      interval: 30s
      timeout: 10s
      retries: 3
```

**Start service:**

```bash
# Start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

---

### Nginx Deployment

#### 1. Upload build artifacts

```bash
# Build locally
npm run build

# Upload to server
scp -r dist/* user@your-server:/var/www/nginx-editor/
```

#### 2. Configure Nginx site

**Create config file `/etc/nginx/sites-available/nginx-editor`**

```nginx
server {
    listen 80;
    server_name editor.example.com;
    
    # Force HTTPS (recommended)
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name editor.example.com;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/editor.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/editor.example.com/privkey.pem;
    
    # SSL security config
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    root /var/www/nginx-editor;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    # Long-term static asset caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Don't cache HTML (ensure updates take effect)
    location ~* \.html$ {
        expires -1;
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Deny hidden files
    location ~ /\. {
        deny all;
    }
}
```

#### 3. Enable site and reload Nginx

```bash
# Create symlink to enable site
sudo ln -s /etc/nginx/sites-available/nginx-editor /etc/nginx/sites-enabled/

# Test config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

#### 4. Configure SSL certificate (using Let's Encrypt)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d editor.example.com

# Auto-renewal (already configured automatically)
sudo certbot renew --dry-run
```

---

### Cloud Platform Deployment

#### Vercel Deployment

**1. Install Vercel CLI**

```bash
npm install -g vercel
```

**2. Deploy**

```bash
# Login
vercel login

# Deploy (creates project on first run)
vercel

# Deploy to production
vercel --prod
```

**3. Configure `vercel.json` (optional)**

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

#### Netlify Deployment

**1. Auto-deploy via Git**

1. Login to [Netlify](https://netlify.com)
2. Click "Add new site" → "Import an existing project"
3. Connect GitHub repository
4. Configure build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
5. Click "Deploy site"

**2. Configure `netlify.toml`**

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

#### Cloudflare Pages Deployment

**1. Deploy via Dashboard**

1. Login to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Go to "Workers & Pages"
3. Click "Create application" → "Pages"
4. Connect Git repository
5. Configure:
   - Framework preset: `Vite`
   - Build command: `npm run build`
   - Build output directory: `dist`

**2. Configure `_redirects` file (place in `public/` directory)**

```
/* /index.html 200
```

---

### CI/CD Automation

#### GitHub Actions

**Create `.github/workflows/deploy.yml`**

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci --legacy-peer-deps
      
      - name: Build
        run: npm run build
      
      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - name: Download artifact
        uses: actions/download-artifact@v4
        with:
          name: dist
          path: dist/
      
      # Deploy to server (using SSH)
      - name: Deploy to Server
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          source: "dist/*"
          target: "/var/www/nginx-editor"
          strip_components: 1
```

**Configure GitHub Secrets:**

1. Go to GitHub repo → Settings → Secrets and variables → Actions
2. Add the following Secrets:
   - `SERVER_HOST`: Server IP or domain
   - `SERVER_USER`: SSH username
   - `SSH_PRIVATE_KEY`: SSH private key

---

### FAQ

#### Q1: Page returns 404 on refresh after deployment

**Cause**: SPA routing is controlled by frontend, server needs to redirect all route requests to `index.html`.

**Solution**: Ensure Nginx config includes:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

#### Q2: Static resources fail to load

**Cause**: Incorrect resource path config or CORS restrictions.

**Solution**: Check `base` config in `vite.config.ts`:

```typescript
export default defineConfig({
  base: '/', // Default, deploy at root
  // base: '/app/', // If deploying in subdirectory
})
```

#### Q3: HTTPS certificate issues

**Cause**: Certificate expired or misconfigured.

**Solution**:

```bash
# Check certificate validity
openssl x509 -in /path/to/cert.pem -noout -dates

# Renew with Certbot
sudo certbot renew
```

#### Q4: Docker container won't start

**Cause**: Port conflict or permission issues.

**Solution**:

```bash
# Check port usage
lsof -i :8080

# Run in privileged mode (for debugging)
docker run --privileged -p 8080:80 nginx-config-editor
```

#### Q5: Build fails - out of memory

**Cause**: Node.js default memory limit.

**Solution**:

```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

---

### 📞 Technical Support

If you encounter issues during deployment:

1. Check [GitHub Issues](https://github.com/your-username/nginx-config-visual-editor/issues)
2. Submit a new Issue describing the problem

---

### 📄 License

MIT License
