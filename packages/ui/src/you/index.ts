// YOU Solution Studio — 子树目录入口（W1B）。
//
// 为什么这是一个「测试入口」而不是公共导出：
// station 的验证命令是 `pnpm exec tsx --test packages/ui/src/you`（仓库根目录执行）。
// Node ≥22 的 test runner 对目录参数的行为是「按模块加载该目录」——经 tsx 的目录
// 解析落到本文件。因此本文件的职责是引入 you 子树的全部逻辑测试（node:test）。
//
// ⚠ 不要把 React 组件（SolutionSurface 等）re-export 到这里：
// 1) tsx 在仓库根目录下无法解析 `@/` 别名（无根 tsconfig），组件图的别名导入会让
//    测试入口直接崩溃；2) 逻辑测试不应拖入 DOM 组件依赖。
// 应用侧（app-shell seam）直接从 `@/you/SolutionSurface.js` 等具体模块导入。
import "./solutionStore.test.js";
import "./solutionProjection.test.js";
import "./solutionExportModel.test.js";
import "./solutionDemo.test.js";
import "./solutionRegistration.test.js";
