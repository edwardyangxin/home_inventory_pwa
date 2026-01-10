# 🏠 家庭库存管理系统 API 文档

**Base URL:** `https://us-central1-home-inventory-483623.cloudfunctions.net`

本文档描述了家庭库存管理系统的后端接口，包含库存预览、语音录入解析、库存同步更新以及智能周报生成。

---

## 1. 📋 预览库存 (Preview Sheet Data)
获取当前 Google Sheet 中所有的库存数据。

- **Endpoint:** `/previewSheetData`
- **Method:** `GET`
- **Auth:** Public (Unauthenticated)

### Response Example
```json
[
  {
    "id": "fd826669-a12c-4d35-b8aa-231ec70baa18",
    "name": "牛奶",
    "category": "食品",
    "location": "冰箱",
    "quantity": 1,
    "unit": "盒",
    "expireDate": "2026-01-12T15:39:03.000Z",
    "status": "normal"
  }
]
```

---

## 2. 🎙️ 语音/文本解析 (Process Voice Input)
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
    "items": [
      {
        "name": "螺丝粉",
        "quantity": 2,
        "unit": "包",
        "expire_date": "2026-07-09"
      },
      {
        "name": "螺丝粉",
        "quantity": 2,
        "unit": "包",
        "expire_date": "2027-01-09"
      }
    ]
  },
  "message": "成功识别。我有螺丝粉共 4 包，其中 2 包在 6 个月后到期，另外 2 包在 1 年后到期。"
}
```

---

## 3. 🔄 库存同步更新 (Update Inventory)
接收结构化的物品列表，自动判断是“新增”还是“修改”现有库存，并写入 Google Sheets。

- **Endpoint:** `/updateInventory`
- **Method:** `POST`
- **Content-Type:** `application/json`

### Request Body
接收 `/processVoiceInput` 返回的 `data` 对象部分：
```json
{
  "items": [
    {
      "name": "螺丝粉",
      "quantity": 2,
      "unit": "包",
      "expire_date": "2026-07-09"
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
  "message": "处理完成：更新 1 项，新增 0 项。"
}
```

---

## 4. 📊 智能库存周报 (Generate Report)
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

## 🔗 推荐的前端交互流程

1. **录入场景：**
   用户说话 -> 前端转文字 -> 调用 API `2` -> 展示识别结果 -> 用户确认 -> 调用 API `3` -> 提示更新成功。

2. **查看场景：**
   用户打开首页 -> 调用 API `1` -> 展示列表。

3. **决策场景：**
   用户点击“吃什么” -> 调用 API `4` -> 展示 AI 建议。
