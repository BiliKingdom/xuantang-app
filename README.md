# 玄汤 App 原型

海龟汤推理社交 App 的 React/Vite 版本。当前版本包含登录门禁、汤库、汤详情、创建房间、等待房、云端联机提问、线索板、猜汤底、复盘、社区发帖、收藏、成就和我的对局历史。

## 运行

```bash
npm install
npm run dev
```

## 环境变量

复制 `.env.example` 为 `.env.local`，填入 Supabase 项目配置：

```bash
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_XUANTANG_LOCAL_ONLY=false
```

未配置 Supabase，或设置 `VITE_XUANTANG_LOCAL_ONLY=true` 时，应用会启用本地开发登录和本机房间 fallback，方便在本机完成一局游戏测试。

## 数据库

Supabase schema 位于 `supabase/migrations/`，种子数据位于 `supabase/seed.sql`。

核心表包括：

- `profiles`
- `soups`
- `soup_cases`
- `soup_rules`
- `rooms`
- `room_members`
- `game_questions`
- `game_clues`
- `game_guesses`
- `community_posts`
- `favorites`
- `achievements`
- `user_achievements`

房间创建、加入、提问和猜底通过 RPC 执行：`create_room`、`join_room`、`ask_room_question`、`submit_room_guess`。RLS 已开启，客户端只使用 anon key。Realtime 订阅使用表级监听，并在客户端按当前 `room_id` 过滤。

## 验证

```bash
npm test
npm run check:text
npm run lint
npm run build
```

本机完整游戏 QA：

```bash
npm run qa:local-game
```

该命令会启动临时无头 Chrome，以 `430x900` 视口完成：注册/登录 -> 首页 -> 红雨衣 -> 创建房间 -> 本机加入 -> 开始游戏 -> 提问 -> 猜汤底 -> 复盘。截图会输出到 `qa-artifacts/`。

云端双用户联机 QA：

```bash
npm run qa:cloud-game
```

该命令会用两个真实 Supabase Auth 会话完成：注册两个用户 -> 房主创建房间 -> 玩家用房间码加入 -> Realtime 收到提问事件 -> 提问生成线索 -> 提交正确汤底 -> 房间进入 `finished`。

## 部署

Vercel 配置：

- Build command: `npm run build`
- Output directory: `dist`
- SPA rewrite: `vercel.json`

Vercel 环境变量：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Supabase Auth 需要配置：

- Site URL: Vercel production URL
- Redirect URLs: Vercel production URL 和本地开发 URL
