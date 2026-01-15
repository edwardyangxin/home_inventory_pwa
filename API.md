# 🏠 家庭库存管理系统 API 文档

**Base URL:** `https://home-inventory-service-392917037016.us-central1.run.app`

本文档描述了家庭库存管理系统的后端接口，包含库存预览、语音录入解析、库存同步更新以及智能周报生成。

---

## 1. 📋 预览库存 (Preview Sheet Data)
获取当前 Google Sheet 中所有的库存数据。

- **Endpoint:** `/previewSheetData`
- **Method:** `GET`
- **Auth:** Public (Unauthenticated)

---

## 2. 🧘‍♂️ 获取生活习惯 (Get Habits)
获取用户预设的生活习惯、常用菜谱或必需品清单。

- **Endpoint:** `/getHabits`
- **Method:** `GET`
- **Auth:** Public (Unauthenticated)

### Response Example
```json
[
  {
    "name": "卷纸",
    "type": "必需品",
    "details": "保持库存至少 4 卷",
    "frequency": "高频",
    "comment": "有时候需要买加厚版"
  }
]
```

---

## 3. 🎙️ 语音/文本解析 (Process Voice Input)
利用 Gemini AI 将用户的口语描述（或文本）转化为结构化的 JSON 数据。
**注意：** 此接口只负责“理解”，不负责“写入”。返回的数据应传给 `/updateInventory` 接口进行写入。

- **Endpoint:** `/processVoiceInput`
- **Method:** `POST`
- **Content-Type:** `application/json`

### Request Body
```json
{
  "text": "我有这个一包两包3包4包螺丝粉OK有两包呢他是6个月后到期有两包呢他是一年后到期"
}
```

### Response Example
```json
{
  "success": true,
  "data": {
    "target": "INVENTORY",
    "items": [
      {
        "name": "螺丝粉",
        "quantity": 2,
        "unit": "包",
        "expire_date": "2026-07-09",
        "category": "食品",
        "location": "橱柜",
        "action": "ADD"
      }
    ],
    "retrieval": false
  },
  "message": "成功识别 (INVENTORY)。购买了2包螺丝粉。"
}
```

**Target 字段说明:**
- `INVENTORY`: 涉及实时库存的操作。下一步应调用 `/updateInventory` (或 `/searchInventory`)。
- `HABIT`: 涉及习惯、菜谱或偏好的操作。下一步应调用 `/updateHabits`。

**Action 字段说明:**
- `ADD`: 新增或补充库存（默认）。
- `CONSUME`: 消耗库存（减少数量）。
- `DELETE`: 删除或清理库存。
- `SET`: 校准库存（将数量直接更新为指定值，用于“只剩下”、“现有”等场景）。
- `QUERY`: 查询操作（根据 `target` 分别调用查询接口）。

---
--- 

## 4. 🔍 库存查询 (Search Inventory)
当 `/processVoiceInput` 返回 `target: "INVENTORY"` 且 `action: "QUERY"` 时调用。

- **Endpoint:** `/searchInventory`
- **Method:** `POST`
- **Content-Type:** `application/json`

### Request Body
接收结构化的物品列表（通常来自 `/processVoiceInput`）：
```json
{
  "items": [
    { "name": "牛奶", "action": "QUERY" }
  ]
}
```

### Response Example
```json
{
  "success": true,
  "results": [
    {
      "query": "牛奶",
      "found": true,
      "matches": [
        {
          "id": "...",
          "name": "牛奶",
          "category": "待分类",
          "location": "冰箱",
          "quantity": 1,
          "unit": "桶",
          "expireDate": "2026-01-25",
          "status": "normal"
        }
      ]
    }
  ]
}
```

---

## 4b. 📖 习惯/菜谱查询 (Search Habits)
当 `/processVoiceInput` 返回 `target: "HABIT"` 且用户有查询意图时调用。
若数据库未命中，会调用 LLM 生成菜谱并返回（`in_database: false`、`source: "AI"`，且 `comment` 标注为“为LLM生成，未添加过该菜谱。”）。

- **Endpoint:** `/searchHabits`
- **Method:** `POST`
- **Content-Type:** `application/json`

### Request Body
```json
{
  "items": [
    { "name": "红薯" }
  ]
}
```

### Response Example
```json
{
  "success": true,
  "results": [
    {
      "query": "红薯",
      "found": true,
      "in_database": false,
      "source": "AI",
      "matches": [
        {
          "name": "红薯焗烤",
          "type": "菜谱",
          "details": "食材: 红薯、黄油、盐。步骤: 1) 红薯洗净切块。2) 水煮至变软。3) 沥干拌入黄油和盐。4) 200度烤10分钟出香气。",
          "frequency": "未知",
          "comment": "为LLM生成，未添加过该菜谱。"
        }
      ]
    }
  ]
}
```

---

## 5. 🔄 库存同步更新 (Update Inventory)
当 `/processVoiceInput` 返回 `target: "INVENTORY"` 且 `action` 为 `ADD/CONSUME/DELETE/SET` 时调用。

- **Endpoint:** `/updateInventory`
- **Method:** `POST`
- **Content-Type:** `application/json`

### Request Body
接收 `/processVoiceInput` 返回的 `data` 对象中的 `items` 部分：
```json
{
  "items": [
    {
      "name": "螺丝粉",
      "quantity": 2,
      "unit": "包",
      "expire_date": "2026-07-09",
      "action": "ADD"
    }
  ]
}
```

### Response Example
```json
{
  "success": true,
  "changes": [
    {
      "type": "UPDATE",
      "name": "螺丝粉",
      "desc": "增加库存: 2 -> 4 包",
      "expire_date": "2026-07-09"
    }
  ],
  "items": [
    {
      "id": "dc694976-e67f-40fb-860d-28efaf6fa119",
      "name": "螺丝粉",
      "category": "食品",
      "location": "橱柜",
      "quantity": 4,
      "unit": "包",
      "expireDate": "2026-07-09",
      "status": "normal"
    }
  ],
  "message": "处理完成。"
}
```

---

## 6. ✏️ 修改库存物品 (Edit Item)
修改库存中某一行的信息（如名称、数量、过期时间等）。

- **Endpoint:** `/editInventoryItem`
- **Method:** `POST`
- **Content-Type:** `application/json`

### Request Body
必须包含 `id`。其他字段可选，仅传入需要修改的字段即可。
```json
{
  "id": "708e041d-9c2f-4da3-b67c-59bb96efcad6",
  "name": "修改后的名称",
  "quantity": 5,
  "unit": "包",
  "expire_date": "2029-01-01"
}
```

### Response Example
```json
{
  "success": true,
  "message": "已更新物品: 修改后的名称",
  "item": {
    "id": "708e041d-9c2f-4da3-b67c-59bb96efcad6",
    "name": "修改后的名称",
    "category": "待分类",
    "location": "未指定",
    "quantity": 5,
    "unit": "包",
    "expireDate": "2029-01-01"
  }
}
```

---

## 7. 🗑️ 删除库存物品 (Delete Item)
根据物品 ID 删除库存中的某一行记录。

- **Endpoint:** `/deleteInventoryItem`
- **Method:** `POST`
- **Content-Type:** `application/json`

### Request Body
```json
{
  "id": "6821f331-6368-4848-8d90-626f035b0860"
}
```

### Response Example
```json
{
  "success": true,
  "message": "已删除物品: 香蕉",
  "deleted_id": "6821f331-6368-4848-8d90-626f035b0860"
}
```

---

## 8. 📊 智能库存周报 (Generate Report)
利用 AI 分析当前库存，生成食用建议、采购清单和创意食谱。

- **Endpoint:** `/generateInventoryReport`
- **Method:** `GET`

### Response Example
```json
{
  "success": true,
  "report": {
    "urgent_eat": [
      { "name": "牛奶", "days_left": 3, "qty": 1, "unit": "盒" }
    ],
    "upcoming_eat": [],
    "shopping_list": [
      { "name": "鸡蛋", "reason": "库存耗尽" }
    ],
    "recipe_ideas": [
      {
        "title": "牛奶燕麦粥",
        "description": "用到了 [牛奶] 和燕麦，制作一份营养丰富的早餐。"
      }
    ]
  }
}
```

---

## 9. 🍽️ 膳食推荐计划 (Recommend Meal Plan)
根据库存中即将过期的食材，生成未来 3 天的具体饮食建议，优先考虑 Habits 中的家庭内部菜谱（`type: "菜谱"`）。

- **Endpoint:** `/recommendMealPlan`
- **Method:** `GET`

### Response Example
```json
{
  "success": true,
  "suggestions": [
    {
      "title": "周一晚餐 - 萝卜豆腐排骨汤",
      "rationale": "优先消耗了快过期的 [萝卜] 和 [豆腐]。",
      "description": "将萝卜、豆腐切块，与排骨一同炖煮..."
    },
    {
      "title": "周二早餐 - 香蕉牛奶",
      "rationale": "消耗了 [香蕉] 和 [牛奶]。",
      "description": "简单的营养早餐搭配。"
    }
  ],
  "summary": "这份计划帮您解决了冰箱里积压的蔬菜和水果。"
}
```

---

## 9b. 🛒 本周采购推荐 (Recommend Weekly Purchase)
根据库存与 habits（偏好/菜谱/必需品）生成本周采购建议，包含解释字段，并标注当前库存与最后一次购买时间（使用 `updated_at`）。

- **Endpoint:** `/recommendWeeklyPurchase`
- **Method:** `GET`

### Response Example
```json
{
  "success": true,
  "suggestions": [
    {
      "name": "鸡蛋",
      "suggested_quantity": 12,
      "unit": "个",
      "reason": "常备必需品，且曾经购买过，现在库存为0",
      "current_stock": { "quantity": 0, "unit": "个" },
      "last_purchase_at": "2024-06-01T12:34:56.000Z"
    }
  ]
}
```

---

## 10. 🔄 更新习惯/菜谱 (Update Habits)
当 `/processVoiceInput` 返回 `target: "HABIT"` 且 `action` 为 `ADD/DELETE/SET` 时调用。用于增量更新生活习惯、常备菜谱或偏好。

- **Endpoint:** `/updateHabits`
- **Method:** `POST`
- **Content-Type:** `application/json`

### Request Body
接收 `/processVoiceInput` 返回 of the `data` 对象中的 `items` 部分：
```json
{
  "items": [
    {
      "name": "烤红薯",
      "type": "菜谱",
      "details": "300度，30分钟，steam&crisp",
      "action": "ADD"
    }
  ]
}
```

### Response Example
```json
{
  "success": true,
  "message": "Habits updated successfully",
  "changes": [
    {
      "type": "ADD",
      "name": "烤红薯",
      "desc": "新增习惯/菜谱"
    }
  ]
}
```

---

## 11. ✏️ 修改习惯 (Edit Habit)
修改已有的生活习惯、菜谱或偏好。

- **Endpoint:** `/editHabit`
- **Method:** `POST`
- **Content-Type:** `application/json`

### Request Body
必须包含 `old_name` 用于定位。其他字段（name, type, details, frequency, comment）可选。
```json
{
  "old_name": "烤红薯",
  "name": "烤红薯 (空气炸锅版)",
  "details": "200度，25分钟"
}
```

### Response Example
```json
{
  "success": true,
  "message": "已更新习惯: 烤红薯 (空气炸锅版)",
  "habit": {
    "name": "烤红薯 (空气炸锅版)",
    "type": "菜谱",
    "details": "200度，25分钟",
    "frequency": "偶尔",
    "comment": ""
  }
}
```

---

## 12. 🗑️ 删除习惯 (Delete Habit)
根据名称删除生活习惯、菜谱或偏好。

- **Endpoint:** `/deleteHabit`
- **Method:** `POST`
- **Content-Type:** `application/json`

### Request Body
```json
{
  "name": "烤红薯 (空气炸锅版)"
}
```

### Response Example
```json
{
  "success": true,
  "message": "已删除习惯: 烤红薯 (空气炸锅版)"
}
```

---

## 🔗 推荐的前端交互流程

1. **录入场景：**
   用户说话 -> 前端转文字 -> 调用 API `3` -> 展示识别结果 -> 用户确认 -> 调用 API `5` -> 提示更新成功。

2. **查看场景：**
   用户打开首页 -> 调用 API `1` -> 展示列表。

3. **决策场景：**
   用户点击“吃什么” -> 调用 API `9` -> 展示 AI 建议。
