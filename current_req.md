我的新需求如下：
1. Suggestions，通过语音录入，识别suggestions for app。使用app会遇到bug，需求等，记录下来，成为开发的backlog
  1. , 保存，自动整理，保存在suggestions sheet
  2. 设计保存的数据结构
  3. 类似habbits的录入过程，不过suggestions只需要做：1. 录入后，自动整理为条目，合并同类的，按照类别做个分类；2. 有个按钮可以查看当前的清单。3. 不需要修改或者删除

api repo要做的是：
1. 创建必要的api
2. 根据需求点设计api
3. 在本地做好测试
4. 如果遇到循环卡点，那么及时停下来，总结当前做了什么、和情况，让我来做下一步的决策

补充与实现总结：
已实现 suggestions 录入与查看，供前端接入参考：
1. 新增接口：
  1. GET `/getSuggestions`：返回 suggestions 清单（数组）。
  2. POST `/updateSuggestions`：语音/文本录入建议，自动整理与合并后写入。
2. 数据结构（suggestions sheet，A-J）：
  1. id, title, category, details, status, count, source_text, merged_from, created_at, updated_at
  2. category 取值：bug | feature | improvement | ux | performance | data | other
3. 自动整理与合并：
  1. LLM 解析语音/文本为结构化 items（title/category/details/merge_id）。
  2. merge_id 或标题相似度匹配后合并，count 自增，merged_from 追加，updated_at 更新。
4. 语音解析支持：
  1. `processVoiceInput` 增加 target= SUGGESTION（仅用于识别，不写入）。
5. 测试与部署：
  1. 新增 `test_suggestions_flow.js`，覆盖 update + get。
  2. 已在本地与 prod 验证通过（update/get）。
6. 前端交互建议：
  1. 语音转文字后调用 `/updateSuggestions`，返回 suggestions 用于展示确认。
  2. “查看清单”按钮调用 `/getSuggestions`。

作为前端PWA工程repo，你要参考api的实现，实现UI部分：
1. 在top增加一个查看suggentions的入口
2. 做好uer_manual.md的更新
3. 在本地做好测试
4. 如果遇到循环卡点，那么及时停下来，总结当前做了什么、和情况，让我来做下一步的决策