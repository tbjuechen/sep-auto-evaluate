// ==UserScript==
// @name         SEP 自动评价
// @namespace    http://tampermonkey.net/
// @version      v0.0.1
// @description  国科大sep自动评价
// @author       tbjuechen
// @match        https://xkcts.ucas.ac.cn/*
// @match        https://xkcts.ucas.ac.cn:8443/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        GM_addStyle
// ==/UserScript==

(function () {
  "use strict";
  function findEvaluatableCourses() {
    // 最终存储结果的数组
    const evaluatableCourses = [];

    // 1. 精准定位到表格的所有行 (tr)
    // 选择 class 为 'mc-body' 下的 table 的 tbody 内的所有 tr 元素
    const courseRows = document.querySelectorAll(
      ".mc-body table.table tbody tr"
    );

    // 2. 遍历每一行来检查
    for (const row of courseRows) {
      // 3. 在当前行中，查找“操作区”列（即最后一个单元格）里是否包含“评估”按钮
      // 这个按钮是一个带有 'btn' 和 'btn-primary' class 的 <a> 标签
      const evaluateButton = row.querySelector("td:last-child a.btn-primary");

      // 4. 如果找到了评估按钮，说明这一行是可评估的
      if (evaluateButton) {
        // 5. 从当前行中提取需要的信息
        // 使用 optional chaining (?.) 来防止因元素不存在而报错
        // 使用 .trim() 来清除文本内容两边的空白字符

        // 提取课程名称 (在第 2 个 <td> 里的 <a> 标签)
        const courseName = row
          .querySelector("td:nth-child(2) a")
          ?.textContent.trim();

        // 提取主讲教师 (在第 7 个 <td> 里的 <a> 标签)
        const teacherName = row
          .querySelector("td:nth-child(7) a")
          ?.textContent.trim();

        // 提取评估链接 (就是评估按钮的 href 属性)
        const evaluateLink = evaluateButton.getAttribute("href");

        // 6. 将提取到的信息作为一个对象，存入结果数组
        if (courseName && teacherName && evaluateLink) {
          evaluatableCourses.push({
            courseName: courseName,
            teacherName: teacherName,
            evaluateLink: evaluateLink,
          });
        }
      }
    }

    // 7. 返回包含所有可评估课程信息的数组
    return evaluatableCourses;
  }

  // 1. 添加样式
  GM_addStyle(`
        #my-draggable-float-window {
            position: fixed;
            top: 100px;
            left: 100px;
            width: 200px;
            /* 调整一下高度以容纳按钮 */
            min-height: 150px;
            background-color: #f1f1f1;
            border: 1px solid #d3d3d3;
            z-index: 9999;
            text-align: center;
            border-radius: 5px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }

        #my-draggable-float-window-header {
            padding: 10px;
            cursor: move;
            background-color: #2196F3;
            color: white;
            font-weight: bold;
            border-top-left-radius: 4px;
            border-top-right-radius: 4px;
        }

        #my-draggable-float-window-content {
            padding: 10px;
            cursor: default;
        }

        /* (可选) 为按钮添加一点样式 */
        #my-action-button {
            padding: 8px 12px;
            background-color: #4CAF50; /* 绿色 */
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            margin-top: 10px;
        }

        #my-action-button:hover {
            background-color: #45a049;
        }
    `);

  // 2. 创建 HTML 元素
  let floatWindow = document.createElement("div");
  floatWindow.id = "my-draggable-float-window";

  // 2.1 创建头部 (用于拖动)
  let header = document.createElement("div");
  header.id = "my-draggable-float-window-header";
  header.textContent = "SEP 自动评价系统";
  floatWindow.appendChild(header);

  // 2.2 创建内容区域
  let content = document.createElement("div");
  content.id = "my-draggable-float-window-content";
  // content.innerHTML = '这是一个悬浮窗。'; // 初始文本
  floatWindow.appendChild(content);

  // ----------------------------------------------------
  // 2.3 【新增】创建按钮并添加到内容区域
  // ----------------------------------------------------
  let myButton = document.createElement("button");
  myButton.id = "my-action-button"; // 给按钮一个 ID，方便用 CSS 选择
  myButton.textContent = "查找待评价老师"; // 按钮上显示的文字

  // (关键) 将按钮添加到 "content" div 中
  content.appendChild(myButton);

  // (可选) 为按钮添加点击事件
  myButton.addEventListener("click", function () {
    console.log(findEvaluatableCourses());
  });
  // ----------------------------------------------------

  // 3. 将窗口添加到页面
  document.body.appendChild(floatWindow);

  // 4. 实现拖动逻辑 (与之前相同)
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

    // 边界检查
    newX = Math.max(
      0,
      Math.min(newX, window.innerWidth - floatWindow.offsetWidth)
    );
    newY = Math.max(
      0,
      Math.min(newY, window.innerHeight - floatWindow.offsetHeight)
    );

    floatWindow.style.left = newX + "px";
    floatWindow.style.top = newY + "px";
  });

  document.addEventListener("mouseup", function (e) {
    isDragging = false;
  });
})();
