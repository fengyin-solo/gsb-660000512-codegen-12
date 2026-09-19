# solo-6600005 - Online Code Interview Platform

## Tech Stack
- **Frontend**: React + TypeScript + Monaco Editor + Socket.io-client
- **Backend**: Java + Spring Boot + WebSocket + Docker Sandbox
- **Database**: MySQL + Redis

## Quick Start

### Backend
```bash
cd backend && mvn spring-boot:run
```

### Frontend
```bash
cd frontend && npm install && npm run dev
```

## 练习数据：归属、权限与离线同步

题库（练习数据）的每条记录都带操作归属，规则如下：

- **负责人（owner）**：提交记录的用户即负责人；负责人可编辑、删除，并可授权/移除协作者。
- **授权协作者（collaborator）**：可改动记录内容，但不能删除、不能改变归属。
- **其他用户（viewer）**：只能查看，编辑/删除入口被禁用，服务层也会拒绝（`PermissionDeniedError`）。
- 右上角可切换当前会话用户，以模拟不同角色；归属信息直接显示在列表中。
- 任何更新/同步都会通过 `preserveOwnership` 强制保留原负责人与协作者，**归属保持不变**。

### 本地数据模式（后端不可用时）

- 任意请求遇到网络错误会自动切换到**本地数据模式**，顶部出现橙色横幅明确提示「已切换到本地数据模式」，并显示待同步改动数与切换时间。
- 离线期间的增删改保存在 `localStorage`，同时写入待同步操作队列（带操作人、时间、内容指纹）；权限规则在本地模式照常生效。

### 恢复后的同步

- 横幅每 15 秒探测后端，也可手动点击「检测后端并同步」。
- 恢复后**先提示授权问题**（离线改动者现已无权限的记录）**和冲突项**（同一记录双方都改且内容不同）。
- **冲突记录不会被覆盖**，需在同步对话框中逐条选择：保留本地 / 采用服务端 / 跳过。
- 无冲突改动可一键同步；跳过或授权受阻的记录保留在本地待同步队列。
- 同步全程归属不变，完成后切回在线模式并以服务端最新数据刷新本地快照。
