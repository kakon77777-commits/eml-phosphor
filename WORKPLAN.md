# PHOSPHOR — WORKPLAN（這一輪）

本檔記錄 2026-07-16 這一輪對話中，關於「PHOSPHOR 下一步怎麼做才不像玩具應用」的診斷與決議。
在真正動工之前先落成文字，供下一輪對話 / 其他 agent session 接續。

現況基準：v0.5.0-beta（VM 家族 + 6 層 CTS + phosphor-stream + EML 互通 + 語義等價判定器）
+ PHOSPHOR-SHEET v1.2（試算表投影 + 治理式 XLSX 控制面）。151 + 61 = 212 tests 綠燈，
對抗式審查文化已建立（v0.5 一輪 34-agent 審查修了 9 個真缺陷）。

---

## 1. 診斷：玩具感從哪來

工程紮實度不是問題所在。玩具感的來源：

1. **展示載體是自創教學型 ISA**（EML-VM-16 / VM-64 / VM-BASIC），範例永遠是
   fibonacci / counter / xor-cipher。CTS 六層、`semanticEquiv` 再嚴謹，證明對象是
   「自製假指令集跑 fib」，還是會被歸類成教學玩具——這跟正確性無關，是「解決了誰的
   真問題」的問題。
2. **三個投影（Human CRT / AI stream / Sheet）從未合成一個完整故事**，各自是獨立文件、
   獨立 demo。
3. **官網文案偏美學/概念先行**（磷光綠 CRT、Klein∞、可見即可視），目前唯一可驗證的
   落地是自製 VM + 測試數字，沒有一個「抓到真的 bug / 驗證了真的等價性」的具體案例。

---

## 2. 本輪確認的方向（已決議）

### 2.1 WASM 作為下一個真實 Φ 目標
把 Φ:M×CTS→V 接到一個真實系統，而不是再發明一個 VM。選 WASM 的原因：Neo 判斷
相對工作量小，且與自身棧（Cloudflare Workers 本身跑 WASM/JS）貼合。
**細節未設計**：WASM 語意比自創 ISA 複雜，CTS 六層對應、snapshot 來源（WASM 執行的
記憶體/棧/local/global 怎麼取）留到 Phase 1 開工時才展開設計。

### 2.2 端到端旗艦案例（要加）
把 Human CRT / AI stream / Sheet 三個投影第一次串成同一個真實故事，而不是三份平行 demo。
提案中的敘事形狀（**尚未定案，Neo 尚未逐條確認細節**）：

> AI agent 改一段真實程式碼 → `semanticEquiv` 判定行為是否等價（抓到/證明不變）→
> 結果進 `09_Control` 試算表由人核准 → 執行並留下 `phosphor-jsonl-v1` 審計軌跡。

具體真實情境（改什麼程式、抓什麼 bug）留到 Phase 2 開工時才選定。

### 2.3 通用改造 Skill（後續，WASM 之後）
- **CTS 六層角色化**：把 opcode/symbol/type/string/comment/crossRef 從 VM 詞彙改寫成
  領域無關角色（狀態轉移最小單位／穩定命名／值域／人類可讀解碼／意圖／資料流溯源）。
- **難度分級（誠實標示，不要含糊喊「什麼都能套」）**：
  - Tier 1：確定性、無時鐘、可逐 tick 重播（VM、純函式、狀態機）——目前唯一被驗證過
    保證成立的層級。
  - Tier 2：事件驅動但可插樁——CTS 角色還套得上，但保證弱化成 best-effort。
  - Tier 3：高度非決定性/分散式——Φ 只能給近似/局部視圖。
- **v1 範圍鎖定 Tier 1**，Tier 2/3 明講是未來項目、不承諾。
- **流程是半自動、協作式，不是全自動 code-mod**：AI 讀目標 codebase → 判斷 Tier →
  提 CTS 對應草案 → 人確認 → 才插樁。理由：這步驟正確與否依賴真正理解目標系統語意，
  全自動容易產出看似合理但錯的 CTS 對應，牴觸專案「execution truth、不硬給結論」的
  紀律。
- **交付形式（提案，Neo 尚未明確拍板）**：目前提案是做成 Claude Code Skill，因為
  貼合 Neo 自己的工具鏈與工作模式，也剛好對應「AI 快速理解＋使用者講用途＋雙方協作
  改造」這個描述。**這一項是開放的**，Neo 沒有逐條確認交付形式一定是 Skill。

### 2.4 PHOSPHOR-SHEET 不採「AI agent 治理」定位（明確不做）
機制（核准後才變更、終態冪等、audit ledger）維持現狀，**但不把 PHOSPHOR-SHEET 包裝成
「AI agent 行動治理/圍堵」**。Neo 給的理由：
- 軟性核准機制無法真的保證圍堵住一個能力持續變強、有意繞過它的 agent，隨著 AI 越來越
  強這個保證只會越來越不現實。
- 用「治理」定位本身會被濫用——讓人誤以為這是真正的安全邊界。

一個**尚待 Neo 確認的細節**：是否把敘事收斂成「legibility / 審計紀錄」（讓人在核准前
看得見 agent 想做什麼、事後留得下紀錄，而不是「控制/圍堵」）——這只是敘事層面的收斂，
機制不變。Neo 回應「這個可以，讓我思考一下」，**尚未拍板**，留待下一輪確認。

---

## 3. 建議執行順序（提案，待 Neo 開工前拍板）

1. **Phase 1** — WASM 真實 Φ 目標：CTS 對應設計 → snapshot builder → 驗證套件
   （比照現有 `verify:*` 模式）。
2. **Phase 2** — 端到端旗艦案例：選定具體真實情境 → 串接三個投影 → 對外可指的一個
   完整故事。
3. **Phase 3** — 通用改造 Skill：CTS 角色化 + Tier 系統文件化 → Skill 化（若確認走
   這個形式）→ 至少一個 Tier 1 之外的目標系統做驗證改造（非 VM、非 WASM，證明「通用」
   不是只對自家兩個案例成立）。

---

## 4. 明確不做 / Non-goals

- 不把 PHOSPHOR-SHEET 定位成 AI agent 治理/安全邊界。
- 通用改造 Skill v1 不承諾 Tier 2/3。
- 通用改造流程不做全自動 one-shot code-mod。
- 不在還沒有真實旗艦案例前，把「通用改造」當成對外主打故事——先把 WASM + 旗艦案例做出來，
  再談通用化，避免「拿一個還沒有真實案例撐腰的方法論去宣傳通用性」。

---

## 5. 狀態

2026-07-16：Neo 全部確認，含 §2.3（改造工具走 Claude Code Skill）與 §2.4
（PHOSPHOR-SHEET 敘事收斂為 legibility / 審計紀錄，機制不變）。

**Phase 1（WASM）完成，v0.6.0-beta**：`wasm/` 四個模組（binary parser / 直譯器 /
CTS 對應 / snapshot builder）+ 手刻真實 `.wasm` fixture，`npm run verify:wasm` →
24 passed，且與 Node 原生 `WebAssembly` 引擎交叉核對逐位元組一致（獨立引擎對答案，
不是自證）。全套驗證 236 checks 綠燈，`typecheck` 零錯誤，無回歸。細節見
`INTEGRATION.md` §6.7。**目前只有 headless 直譯器，`ui/` 跟 PHOSPHOR-SHEET 都還沒接
WASM**——這是刻意留給 Phase 2 的範圍，不是遺漏。

Phase 2（端到端旗艦案例）、Phase 3（通用改造 Skill）尚未開工。

---

## 附註（另一個並行 session，2026-07-16）

同一天有另一個 Claude Code session 在跑 **PHOSPHOR-MCCP**（真實 Python 程式追蹤 + 計算圖 +
AI 解釋，獨立 repo `github.com/kakon77777-commits/phosphor-mccp`，不是本 repo 的一部分）。
概念上跟本文件 §2.3「通用改造 Skill」規劃的方向重疊——MCCP 實質上就是 Tier 2/3（事件驅動、
非決定性、只能插樁近似）的一個實作，PHOSPHOR/WASM 則是 Tier 1。Neo 已確認**兩邊程式碼維持
分開**（技術棧差太多，TS+VM 直譯器 vs Python+真實程序追蹤），事件流協定要不要往
`phosphor-jsonl-v1` 對齊留到兩邊都各自有旗艦案例後再談，不在這輪動。

那個 session 對**本 repo**唯一動的地方：`web/src/App.tsx`（nav 加一個帶 WIP 標籤的 MCCP
連結）+ 新增 `web/public/mccp/index.html`（獨立靜態頁，說明 MCCP 現況、明講尚未完成）。
已獨立 commit（`0c9358b`），**沒有動這份 WORKPLAN.md 之外或 WASM 相關的任何檔案**，跟本輪
WASM 工作（`wasm/`、`ui/src/WasmView.jsx`、`test-wasm.ts` 等，目前都還沒 commit）完全不重疊，
純粹留這則附註避免兩個 session 之後改 `App.tsx` 互相蓋掉。

**UI 階段（2026-07-16，Neo 加碼指示）**：
1. **WASM 接上 `ui/`**：新增 `ui/src/WasmView.jsx`（▸ WASM 分頁），直接 import `wasm/`
   後端模組（單一引擎原則），瀏覽器內驗證 STEP/RUN/RESET 皆正確，跑到底與
   `verify:wasm` 同一顆 fixture 結果一致（240 ticks、fib(0..10)）。
2. **六主題系統 + 設定 UI**：`theme.jsx` 的 `C` token 改為 CSS variable 參照
   （`var(--p-xxx)`），零改動沿用到既有 ~200 處呼叫點；新增 `PHOSPHOR`(原版)、
   `深邃`、`墨金`、`米白`（唯一亮色）、`赤紅`、`冷藍海洋` 六套палette + `ThemeSwitcher`
   下拉選單（localStorage 持久化 + 防閃爍 inline script）。順手修了兩處會在
   var() 下失效的 hex-alpha 拼接、CRT scanline/vignette 改吃
   `--p-scan-alpha`/`--p-vignette-alpha`（米白亮色主題調淡）、以及 `PhosphorVM.jsx`
   /`EquivLab.jsx` 原本各自寫死一份獨立 `C`（`EquivLab` 甚至没接共享 theme、
   `PhosphorVM` 缺一個 `fg` key 是既有 bug）——這兩個主分頁原本switch主題完全沒反應，
   現已接上共享 token。**明講的殘餘範圍**：仍有零星 per-widget 寫死色（次要提示色
   等）沒有全部 token 化，屬已知後續項，不是本輪隱藏的缺口。
3. **虛擬寵物區 v0（2026-07-16，Neo 定調後落地）**：Neo 明確定位這是「之後要找開源
   ／未來可能做抓圖即寵物生成」的更大專案的一角，這一輪只做最小、老實的版本——
   新增 `ui/src/PetZone.jsx`（▸ PET 分頁）：背景真的跑一個 headless WASM VM
   （複用 `verify:wasm` 同一顆 fixture，非裝飾用假資料）；簡單方塊生物（SVG，
   跟六套主題同色系）依 `changed_this_tick`/`halted` 真實狀態切換 idle/active/
   write/halted 情緒；規則式（非 LLM）口白，~1.9s 一句，**英文／日文可切換
   （2026-07-16 改：拿掉中文——瀏覽器中文語音合成不可愛，Neo 原話）**；語音走
   瀏覽器原生 `SpeechSynthesis`，預設關閉、可切換，讀不到就靜默略過。瀏覽器實測：
   背景 VM 確實在跑（tick 持續增加）、口白隨真實 tick/write 變化、EN/日本語切換
   即時生效、語音開關無錯誤。
   **明確不做**（Neo 定的範圍）：寵物客製化／使用者自建、抓圖生成、LLM 敘事——
   都留給以後那個更大的專案，這裡的成品是「不誇大」的最小版本。

   **兩個回報後修的 bug**：
   (a) 日文口白原本把 `Φ`／`M`／`CTS`／hex 位址／箭頭直接塞進日文句子念出來，
       TTS 遇到符號混搭念得很怪——改成口白跟資料脫鉤，只依情緒（idle/計算中/
       剛寫入/完成）挑幾句乾淨短句，不再念任何符號；技術細節留在
       「WHAT IT'S ACTUALLY WATCHING」文字區塊。
   (b) 選日文卻聽到中文語音——根因是原本只設定 `utterance.lang`，沒有明確指定
       `utterance.voice`；多數瀏覽器在沒指定 voice 物件時會直接用系統預設語音，
       忽略 lang 提示。改成明確從 `speechSynthesis.getVoices()` 找語言前綴匹配
       的 voice 物件並指定上去；**找不到對應語言的語音就靜音，不會再用錯的語言
       念出來**（跟 semanticEquiv 的「答不出來就 inexpressible」同一種紀律）。
       附註：Claude Browser 測試環境本身只有 3 個 `zh-TW` voice，沒有日/英文
       voice，所以這邊只能驗證「不會念錯」，驗證不了「真的念對」——Neo 自己的
       瀏覽器/系統要有安裝日文或英文 TTS 語音包，才聽得到聲音。

   **(c) 徹底繞開 TTS 語音包依賴（2026-07-17，Neo 加裝日文語言包後落地）**：
   改成離線一次性烤好靜態音檔，執行期不再呼叫 `SpeechSynthesis`。
   `ui/scripts/generate-pet-voices.ps1`（Windows-only 工具，非 runtime 一部分）
   用 .NET 內建 `System.Speech`（零新套件）+ SSML `<prosody pitch=…>` 調高音調，
   讀 `ui/src/pet-lines.json`（單一資料源，畫面文字跟音檔內容不會走鐘）逐句烤成
   `ui/public/pet-voices/<lang>/<mood>-<index>.wav`（en 用 Zira、ja 用 Haruka，
   Neo 這台機器裝日文語言包後才有的語音），24 個檔案共 2.4MB。前端改成
   `new Audio(...).play()` 播放靜態檔——**執行期零依賴，音檔對所有使用者都一樣，
   不再看使用者系統裝了什麼語音**。瀏覽器實測：network log 顯示對應 mood/index
   的 wav 檔正確依真實 tick 動態切換請求（206 Partial Content）。

---

## 6. 這一輪收尾（2026-07-17）

已 commit + push（`2c83a18`，fast-forward on top of 另一 agent 同步推的
`0c9358b`「web: MCCP nav link」，兩邊檔案零重疊，無覆蓋風險）。

**下一步已確認：Phase 2（端到端旗艦案例），不是繼續加深 WASM 本身**——WASM 現有
驗證強度（跟 Node 原生引擎逐位元組核對）已是能拿到的最強證明，再加 opcode/i64/
table 只加維護面積、不會讓「這是真的」這個論點更強，報酬遞減。真正回應「不像
玩具」這個起始目標的是 Phase 2：把 Human CRT / AI stream / Sheet 三個投影第一次
串成同一個真實故事。**順手做、不單開一輪**：Phase 2 選定的情境直接換成一個用
真正工具鏈編譯出來的 `.wasm`（不是我們自己手刻的 fixture），一次解掉「這份 WASM
是不是自己拼湊的」最後一點疑慮。

Phase 2 具體情境（哪段程式碼、抓什麼 bug、用什麼真實 .wasm 來源）尚未選定——
下一輪開工時再設計，不要一開始就假設細節。

---

## 7. Phase 2 具體設計（2026-07-18，選定 + 可行性已驗證）

**情境**：AI agent 對一段真實 Rust 程式提了一個「優化」——把 `add()` 函式 inline
掉，少一次 call。`wasmSemanticEquiv`（要新建，比照 `eml-semantic.ts` 的
`semanticEquiv` 同一套紀律移植到 WASM）判斷優化前後是否等價，結果進
PHOSPHOR-SHEET `09_Control` 給人核准，核准後才真的切換執行版本，留下
`phosphor-jsonl-v1` 稽核軌跡。刻意做**兩種**優化提案，各走一次完整流程：
一個真的等價（核准、換上、正常跑），一個看起來像優化但其實引入 off-by-one
bug（equivalence judge 抓到 not-equivalent、附反例，人在 Sheet 上看到就不核准）——
不是只演「一切正常」，是連「這工具真的擋下一個錯誤」都做出來。

**可行性已驗證（`wasm/rust-fixtures/`）**：三個真實 `.wasm`，用機器上現成的
`rustc`（`--target wasm32-unknown-unknown`，**不是**額外裝的依賴）+ `-O`
真的最佳化編譯出來的——不是我們自己拼的位元組：

- `baseline.rs` — fib(0..=n)→記憶體，`add()` 保留成真的 call（`#[inline(never)]`）。
- `optimized-correct.rs` — inline `add()`，行為跟 baseline 相同。
- `optimized-buggy.rs` — 同樣 inline，但迴圈邊界從 `i <= n` 被「順手簡化」成
  `i < n`——典型 off-by-one，悄悄漏掉最後一個 fib 值。

三個都已經餵過我們自己的直譯器：baseline 逐位元組核對 Node 原生引擎（真實
rustc 輸出，含 `block`+`loop` 巢狀結構，比 Phase 1 手刻的 fixture 用到更多真實
控制流），optimized-correct 對 n=3/n=10 完全等於 baseline，optimized-buggy 在
n=3/n=10 都在最後一格漏寫（驗證了「差異真的存在、抓得到」，不是紙上談兵）。
過程中發現真實 rustc `-O` 會把相鄰兩個 i32 store 合併成一個 i64 store（超出
WASM-MVP 不支援 i64 的範圍）——改用 `core::ptr::write_volatile` 禁止這個合併，
不是放寬 profile 去遷就，紀律跟 Phase 1 一致（見 `build.sh` 註解）。

**還沒做**（下一步）：
1. `wasm/wasm-semantic.ts` — `wasmSemanticEquiv`，跑兩份 WASM 對抗式輸入比較
   observable output（這裡是記憶體區段內容，不是暫存器）。
2. PHOSPHOR-SHEET `09_Control` 接上這個新指令類型（提案→驗證結果→待核准→
   核准/駁回→執行/不執行），沿用既有 governed control-plane 機制，不重造。
3. UI：`WasmView` 或新分頁能觸發「提議這個優化」，Sheet 分頁看到待核准列，
   核准後真的切換 `WasmView` 正在跑的程式版本。
4. 驗證套件 + docs（比照 `test-wasm.ts`/`INTEGRATION.md` 既有規格）。

---

## 8. Phase 2 完成（2026-07-18）

四項都做完、瀏覽器實測過、headless 驗證套件也綠燈，v0.7.0-beta。

1. **`wasm/wasm-semantic.ts`**：`wasmSemanticEquiv`，`semanticEquiv` 同一套紀律
   移植到 WASM 的 call/記憶體區段形狀。誠實收斂：WASM i32 值域不可能窮舉，
   `exhaustive` 明講只代表「呼叫端宣告的有界定義域被覆蓋」，跟 VM-16 那邊
   「對整個值域的真證明」不是同一份強度——同一個字，不同保證，講清楚不要含糊。
   另一項真實調整：兩個行為等價的二進位可以合法有不同記憶體位址，判定器對兩邊
   程式各自呼叫 `outputPtrExport` 找自己的位址，不假設共用固定位址。
2. **`spreadsheet/phosphor-control.ts` + `phosphor-control-host.ts`**：新增
   `wasm:apply_optimization` 指令，**硬性拒絕**任何 verdict 不是 `equivalent`
   的提案、不論 Approved 欄位為何——人的核准是「要不要採用已證明安全的優化」的
   裁量權，不是拿來覆蓋沒通過驗證的提案。`wasm/wasm-sheet-bridge.ts` 把判定結果
   包成列，**在人看到之前**就把 verdict 寫進 `args_json`。
3. **`ui/src/FlagshipView.jsx`**（▸ FLAGSHIP 分頁）：三個投影畫在同一畫面——
   Human CRT 顯示「目前實際在跑」的版本、AI stream 顯示即時稽核事件、Sheet
   控制格顯示待核准列。瀏覽器實測：提兩案、都核准（模擬人看漏buggy的）、
   執行——safe 版 EXECUTED 且 Human CRT 真的切換成 optimized-correct（halt tick
   248→212，inline 少一次 call/return，數字也對得起來）；buggy 版 REJECTED，
   即使核准了也沒被執行。過程中修了一個真的 bug：兩個提案在同一 tick 連續觸發時
   `setWorkbook` 讀到同一份 stale closure、後者蓋掉前者——改用 functional
   setState 修正。
4. **`test-wasm-semantic.ts`**（`verify:wasm-semantic` → 17 passed）+
   `INTEGRATION.md` §6.8 + `README.md` 都更新了。全套驗證 253 checks，
   `typecheck` 零錯誤，無回歸。

**尚未開工**：Phase 3（通用改造 Skill：CTS 角色化 + Tier 系統 + Claude Skill）。
