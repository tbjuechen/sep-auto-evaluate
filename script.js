// ==UserScript==
// @name         SEP 自动评价 (教师+课程智能版)
// @namespace    http://tampermonkey.net/
// @version      v0.0.3
// @description  国科大SEP选课系统自动评价，智能识别课程/教师评估并填充相应内容
// @author       tbjuechen & Gemini
// @match        https://xkcts.ucas.ac.cn/*
// @match        https://xkcts.ucas.ac.cn:8443/*
// @match        https://jwxk.ucas.ac.cn/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        GM_addStyle
// ==/UserScript==

(function () {
  "use strict";

  // --- 核心逻辑函数 ---

  /**
   * 功能1：在列表页查找待评估的课程
   * 适用于：https://jwxk.ucas.ac.cn/evaluate/course/* 列表页面
   */
  function findEvaluatableCourses() {
    const evaluatableCourses = [];
    const courseRows = document.querySelectorAll(".mc-body table.table tbody tr");

    for (const row of courseRows) {
      // 查找包含“评估”的按钮 (通常是 btn-primary)
      const evaluateButton = row.querySelector("td:last-child a.btn-primary");

      if (evaluateButton) {
        const courseName = row.querySelector("td:nth-child(2) a")?.textContent.trim();
        const teacherName = row.querySelector("td:nth-child(7) a")?.textContent.trim();
        const evaluateLink = evaluateButton.getAttribute("href");

        if (courseName && evaluateLink) {
            evaluatableCourses.push({
                courseName,
                teacherName,
                evaluateLink
            });
        }
      }
    }
    return evaluatableCourses;
  }

  /**
   * 功能2：智能填充评估页面 (支持 教师评估 和 课程评估)
   */
  function autoFillSmart() {
    let radioCount = 0;
    let textCount = 0;

    // --- 1. 客观打分题 (矩阵单选) ---
    // 自动勾选所有 Value="5" (非常符合/非常满意)
    const scoreRadios = document.querySelectorAll('input[type="radio"][value="5"]');
    scoreRadios.forEach(radio => {
        radio.click();
        radio.checked = true;
        radioCount++;
    });

    // --- 2. 智能主观题填充 (根据题目文字判断) ---
    const textAreas = document.querySelectorAll('textarea');
    textAreas.forEach(area => {
        // 获取题目文字：HTML结构通常是 <div>题目</div> <div><textarea></div>
        // 所以我们找 textarea 父级的上一个兄弟元素
        const parentDiv = area.parentElement;
        const labelDiv = parentDiv.previousElementSibling;
        const questionText = labelDiv ? labelDiv.textContent : "";

        let fillText = "";

        // 策略路由：根据题目关键词决定填什么
        if (questionText.includes("花费多少小时") || questionText.includes("每周")) {
            fillText = "4-6小时"; // 针对课程评估Q3
        } else if (questionText.includes("改进") || questionText.includes("意见")) {
            fillText = "课程设置合理，老师讲解透彻，暂无改进建议。"; // 针对Q2及通用意见
        } else if (questionText.includes("兴趣") || questionText.includes("参与之前")) {
            fillText = "在选修之前对该领域非常感兴趣，希望建立系统的知识体系。"; // 针对课程评估Q4
        } else if (questionText.includes("参与度") || questionText.includes("出勤")) {
            fillText = "出勤率100%，课堂上紧跟老师思路，积极参与讨论。"; // 针对课程评估Q5
        } else if (questionText.includes("喜欢什么") || questionText.includes("最喜欢")) {
            fillText = "最喜欢老师的授课方式，理论联系实际，深入浅出，让我受益匪浅。"; // 针对课程评估Q1
        } else {
            // 默认通用好评 (用于教师评估或无法识别的题目)
            const comments = [
                "老师治学严谨，备课充分，对学生严格要求，我们收获很大。",
                "教学内容丰富，重点突出，不仅传授知识，还注重培养科学思维。",
                "老师讲课非常有激情，能够调动学生的积极性，课堂气氛活跃。"
            ];
            fillText = comments[Math.floor(Math.random() * comments.length)];
        }

        // 只有当没有内容或内容太短时才填充
        if (!area.value || area.value.length < 5) {
            area.value = fillText;
            textCount++;
        }
    });

    // --- 3. 杂项单选与多选 (针对课程评估底部的非打分项) ---
    
    // 处理漏掉的单选组 (如：教室舒适度)
    // 逻辑：遍历所有radio name，如果该组没有选中的，就默认选第一个(通常是A.合适)
    const allRadios = document.querySelectorAll('input[type="radio"]');
    const radioGroups = new Set();
    allRadios.forEach(r => radioGroups.add(r.name));
    
    radioGroups.forEach(name => {
        const group = document.getElementsByName(name);
        let hasChecked = false;
        for (let i = 0; i < group.length; i++) {
            if (group[i].checked) hasChecked = true;
        }
        if (!hasChecked && group.length > 0) {
            group[0].click(); // 默认选A
            group[0].checked = true;
            radioCount++;
        }
    });

    // 处理多选框 (如：修读原因)
    // 逻辑：如果没有勾选，默认勾选前两个 (通常涵盖"导师要求"或"兴趣")
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((cb, index) => {
        if (!cb.checked) {
             // 简单的策略：全选或者选特定的。这里为了通过校验，勾选所有看起来是积极的选项
             // 在提供的HTML中，Item_1630是修读原因。勾选前两个一般没问题。
             if (index < 2) { 
                 cb.click();
                 cb.checked = true; 
             }
        }
    });

    // --- 4. 聚焦验证码 ---
    const captchaInput = document.getElementById("adminValidateCode");
    if (captchaInput) {
        captchaInput.focus();
        captchaInput.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    return { radioCount, textCount };
  }

  // --- UI 构建部分 ---

  GM_addStyle(`
        #my-draggable-float-window {
            position: fixed;
            top: 150px;
            right: 50px;
            width: 220px;
            min-height: 120px;
            background-color: #ffffff;
            border: 1px solid #e0e0e0;
            z-index: 99999;
            text-align: center;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
        }

        #my-draggable-float-window-header {
            padding: 12px;
            cursor: move;
            background-color: #007bff;
            color: white;
            font-weight: bold;
            font-size: 14px;
            border-top-left-radius: 8px;
            border-top-right-radius: 8px;
            user-select: none;
        }

        #my-draggable-float-window-content {
            padding: 15px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            align-items: center;
        }

        .sep-btn {
            padding: 8px 16px;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            transition: background-color 0.2s;
            width: 100%;
        }

        #btn-find-courses {
            background-color: #17a2b8;
        }
        #btn-find-courses:hover { background-color: #138496; }

        #btn-auto-fill {
            background-color: #28a745;
        }
        #btn-auto-fill:hover { background-color: #218838; }

        .sep-status-text {
            font-size: 12px;
            color: #666;
            margin-top: 5px;
        }
    `);

  let floatWindow = document.createElement("div");
  floatWindow.id = "my-draggable-float-window";

  let header = document.createElement("div");
  header.id = "my-draggable-float-window-header";
  header.textContent = "SEP 评教助手 (智能版)";
  floatWindow.appendChild(header);

  let content = document.createElement("div");
  content.id = "my-draggable-float-window-content";
  floatWindow.appendChild(content);

  // --- 根据页面类型渲染按钮 ---
  const currentUrl = window.location.href;
  const statusText = document.createElement("div");
  statusText.className = "sep-status-text";

  // 判断是否为评估页面 (包含 evaluateTeacher 或 evaluateCourse)
  const isEvalPage = currentUrl.includes("evaluateTeacher") || currentUrl.includes("evaluateCourse") || document.querySelector("#regfrm");

  if (isEvalPage) {
      let fillBtn = document.createElement("button");
      fillBtn.id = "btn-auto-fill";
      fillBtn.className = "sep-btn";
      fillBtn.textContent = "一键全选好评 + 填充";
      fillBtn.onclick = function() {
          const res = autoFillSmart();
          statusText.textContent = `已自动处理 ${res.radioCount} 个选项，填写 ${res.textCount} 个问答。请手动输入验证码。`;
          statusText.style.color = "green";
      };
      content.appendChild(fillBtn);
  } else {
      let findBtn = document.createElement("button");
      findBtn.id = "btn-find-courses";
      findBtn.className = "sep-btn";
      findBtn.textContent = "查找待评价课程";
      findBtn.onclick = function() {
          const list = findEvaluatableCourses();
          if (list.length > 0) {
              console.log(list);
              statusText.textContent = `发现 ${list.length} 门待评课程 (详情见F12控制台)`;
          } else {
              statusText.textContent = "当前页面未发现待评课程按钮";
          }
      };
      content.appendChild(findBtn);
  }

  content.appendChild(statusText);
  document.body.appendChild(floatWindow);

  // --- 拖拽逻辑 ---
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  header.addEventListener("mousedown", function (e) {
    isDragging = true;
    offsetX = e.clientX - floatWindow.offsetLeft;
    offsetY = e.clientY - floatWindow.offsetTop;
    e.preventDefault();
  });

  document.addEventListener("mousemove", function (e) {
    if (!isDragging) return;
    let newX = e.clientX - offsetX;
    let newY = e.clientY - offsetY;
    const maxX = window.innerWidth - floatWindow.offsetWidth;
    const maxY = window.innerHeight - floatWindow.offsetHeight;
    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));
    floatWindow.style.left = newX + "px";
    floatWindow.style.top = newY + "px";
  });

  document.addEventListener("mouseup", function () {
    isDragging = false;
  });

})();