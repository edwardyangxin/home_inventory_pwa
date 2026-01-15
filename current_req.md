我的新需求如下：
4. 本周采购
  1. 参考库存
  2. 参考偏好、家庭的菜谱？
  3. 考虑item =0的记录，说明曾经购买过，现在没了

这是一个根据inventory/habits两个sheets，给我做一个推荐本周采购的需求。

api repo要做的是：
1. 创建必要的api
2. 根据需求点设计api
3. 在本地做好测试
4. 如果遇到循环卡点，那么及时停下来，总结当前做了什么、和情况，让我来做下一步的决策

补充与实现总结：
- 新增 API：`GET /recommendWeeklyPurchase`
- 返回字段：`name`、`suggested_quantity`、`unit`、`reason`、`current_stock`、`last_purchase_at`
  - `last_purchase_at` 来自 items 的 `updated_at`
- 规则要点：
  - 必须包含库存为 0 的历史物品，说明“曾经购买过，现在没了”
  - 结合 habits 中菜谱/偏好/必需品做推荐
  - 排除 habits 中 `type=忌口` 的物品
- 已新增本地测试脚本：`test_weekly_purchase.js`
  - 本地测试命令：`BASE_URL=http://localhost:8080 node test_weekly_purchase.js`

前端PWA要做的是:
1. api repo 已经实现完成，只考虑PWA repo 这个前端实现
1. 有了本周采购推荐的接口, API.md文件更新了
2. 添加一个button on top
3. 设计UI的实现
4. 本地测试