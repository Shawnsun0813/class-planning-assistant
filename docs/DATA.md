# 数据来源与使用边界

日期：2026年11月11日。四份数据均由用户上传，保留原文件、SHA-256、工作表名称与源行号。它们是历史资料，不是2027年当前开课、资格或竞价规则。

## 已接入文件

| 原文件 | 工作表与范围 | 归一化产物 | 有效记录 |
| --- | --- | --- | --- |
| Auction-Bidding-History.xlsx | 22张表，正常标签为Fall2015至Spring2026；另有Fall2000和Spring2000异常标签 | data/bidding-history.json | 2,714 |
| Enrollment-History.xls | 38张表，Fall2007至Spring2026 | data/enrollment-history.json | 3,658 |
| International-Exchange-Bidding-History.xlsx | 2025–2026交换项目，7个目的地 | data/exchange-history.json | 7 |
| SOM Students in NonSOM Courses for Portal.xlsx | Fall2023至Spring2026，按项目分组的跨院课程人数 | data/nonsom-history.json | 1,071 |

原文件在[data/raw](../data/raw/)，机器可读来源hash和检查结果在[data-audit.json](../data/data-audit.json)。四表的字段和非空内容属于课程、教师、人数和历史轮次汇总；未见学生姓名、邮箱、学号或个人出价。教师姓名属于课程元数据，不冒充学生评价。文件由用户指定用于本项目，未据此宣称已取得学校的另行公开转载许可。

## 竞价字段

竞价表按历史学期、具体教学班及源行保留记录。新版列名是`Round 1`等，旧版部分列明确写`Clearing Price`。

- `metric: clearing_price`仅用于原列名明确带Clearing Price的值。
- `metric: reported_round_value`用于只写Round N的列；在规则核对前仅称“历史轮次值”，不能认证为个人出价或精确中标门槛。
- `value: 0`保留为数值零；空白、N/A和n/a变为`null`，原值在`rawValue`保留，不能将缺失当零。
- `Round 3 (GSR Only)`等限定标签保留原文，不能将专用轮次当作所有同学适用。
- `Seats`、`Open`是当时表中记录，不是当前余位。999等特殊数值不擅自解释成无限名额。
- 没有完整个人出价、失败出价及分配结果，不能根据这些表计算可靠个人成功概率。

Fall2000和Spring2000位于近年工作表之间，明显值得核查，但没有证据可直接更正为2020；原标签保留并附`term_label_anomaly`，默认不用于近期对比。另有8行同学期、同代码和section的重复键记录，附`duplicate_course_section_term`，保留源行而不静默去重或平均。

## 同一代码不一定是同一门课

源文件确认了代码复用，因此跨年匹配必须同时核对标题、课程代码、section、学期及适用轮次，不能只按数字搜历史分数。

| 代码 | 源文件中的不同标题示例 |
| --- | --- |
| MGT 554 | AI for Business Decisions；Luxury: From Mortal Sin to Market Sector |
| MGT 561 | Product Management；Energy Technology Innovation |
| MGT 651 | 历史竞价仅见Innovation and Reform in the Delivery of Legal Services，不能用于Thinking with Data |
| MGT 652 | 历史竞价是International Entrepreneurship，不能用于Design of Business Models |
| MGT 846 | Introduction to Private Equity；Financial Inclusion in International Development: The Evolution from Microcredit to Inclusive Finance |

数据提供`courseTitleKey`（标题去空白、标点并转小写后的匹配键）。竞价记录中一个代码对应多个标题时附`course_number_has_multiple_titles`。此键仅帮助检查，不证明略有不同的标题一定等同或不同。

Spring2026原表中，554-01的三轮记录是5／300／261；561-01是0／80／258；531-02是0／1／20；846-01是85／0／402。它们的列名均只是Round N，适用上述语义限制；没有由此生成2027建议或成功保证。

## 各数据集不可混用的含义

Enrollment记录按历史学期保留教师、学段、学分及人数。早期合计有SOM名下人数，较新的Total Enrollment可能包括跨院人数，`totalMetric`区分来源列范围。历史报名人数超过当时表列上限不等于当前无资格，也不构成未来成功率。历史学分不直接替代当前课程学分。所有报名表均无常规上课时刻，不能从它们生成2027课程时间。

Exchange目的地竞价单独保存，不与普通选修课程合并，也不假定使用同一预算。

NonSOM是SOM同学历史选过哪些跨院课程的分项目计数，空计数保留null。它可作为探索线索，不能证明当前仍开课、有权限报名或教学质量。当前跨院候选的时间、许可及资格需另外核对。

## 应用接口

每个JSON顶层均为`{schemaVersion, source, semantics, recordCount, records}`。

竞价记录关键字段：`id`、`term`、`season`、`year`、`courseNumber`（如MGT 554）、`section`（01）、`courseCode`（MGT 554-01）、`title`、`courseTitleKey`、`type`、`seats`、`open`、`rounds`、`qualityFlags`、`sourceSheet`、`sourceRow`。

`rounds`元素为`{round, label, value, rawValue, metric}`。课程资料与历史记录匹配不成立时应展示“未找到同名课程的可比历史”，不取代码相同的另一门课补齐。

Enrollment记录另有`session`、`instructor`、`units`、`enrolledUnderSom`、`enrolledUnderCrossList`、`totalEnrolled`、`totalMetric`、`enrollmentLimit`。空值代表未提供，不能用于认证已满足硬约束。

## 复现与检查

依赖是openpyxl 3.1.5和xlrd 2.0.1。建议项目本地虚拟环境；当前云端已有这两个版本，未进行全局安装。

```bash
python3 -m venv .venv-data
.venv-data/bin/pip install -r scripts/requirements-data.txt
.venv-data/bin/python scripts/normalize_data.py --input-dir data/raw --output-dir data
.venv-data/bin/python scripts/validate_data.py
```

归一化脚本已实际运行。检查通过：原始文件hash匹配、记录数、真实554三轮值、标题复用、零与缺失区分、显式与非显式列语义、异常学期保留、重复源行保留、Exchange和NonSOM独立用途以及Enrollment无上课时刻。未执行个人中标效果验证，也未据此认证2027正式课程或当前规则。
