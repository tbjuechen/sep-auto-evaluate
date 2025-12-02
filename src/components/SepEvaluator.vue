<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { GM_xmlhttpRequest } from '$';

// --- Configuration ---
// 请在此处填写您的云码 API Token 和类型
const YM_TOKEN = "0DlDANUH5WkT35GZoyIqNLTOCMFamxgzVn5pNvKVUXA"; 
const YM_TYPE = "10110"; // 10110 代表 4位英文数字，根据实际情况调整

// --- State ---
const floatWindow = ref<HTMLElement | null>(null);
const position = ref({ top: 150, left: 100 });
const isDragging = ref(false);
const offset = ref({ x: 0, y: 0 });
const statusText = ref('');
const statusColor = ref('#666');

// Determine page type
const currentUrl = window.location.href;
const isEvalPage = computed(() => {
  return currentUrl.includes("evaluateTeacher") || 
         currentUrl.includes("evaluateCourse") || 
         !!document.querySelector("#regfrm");
});

// --- Logic Functions ---

/**
 * 功能1：在列表页查找待评估的课程
 */
const findEvaluatableCourses = () => {
    const evaluatableCourses = [];
    const courseRows = document.querySelectorAll("table tbody tr");

    for (const row of courseRows) {
      // 查找包含“评估”的按钮 (通常是 btn-primary)
      const evaluateButton = row.querySelector("td:last-child a.btn-primary");

      if (evaluateButton) {
        const buttonText = evaluateButton.textContent?.trim();
        const courseName = row.querySelector("td:nth-child(2) a")?.textContent?.trim();
        const teacherName = row.querySelector("td:nth-child(7) a")?.textContent?.trim();
        const evaluateLink = evaluateButton.getAttribute("href");

        if (courseName && evaluateLink) {
            evaluatableCourses.push({
                courseName,
                teacherName,
                evaluateLink,
                isPending: buttonText === "评估" // 只有文字严格为“评估”的才是未评的
            });
        }
      }
    }
    return evaluatableCourses;
};

/**
 * 辅助函数：将图片转换为 Base64
 */
const getBase64Image = (img: HTMLImageElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    try {
        ctx.drawImage(img, 0, 0);
        return canvas.toDataURL("image/png");
    } catch (e) {
        console.error("无法获取验证码Base64，可能是跨域问题", e);
        return "";
    }
};

/**
 * 辅助函数：调用云码 API 识别验证码
 */
const identifyCaptcha = (base64Image: string) => {
    // 移除 data:image/png;base64, 前缀
    const pureBase64 = base64Image.split(',')[1];

    const data = JSON.stringify({
        "token": YM_TOKEN,
        "type": YM_TYPE,
        "image": pureBase64
    });

    console.log("正在请求云码 API 识别验证码...");

    GM_xmlhttpRequest({
        method: "POST",
        url: "http://api.jfbym.com/api/YmServer/customApi",
        headers: {
            "Content-Type": "application/json"
        },
        data: data,
        onload: function (response) {
            console.log("云码 API 响应:", response.responseText);
            try {
                const res = JSON.parse(response.responseText);
                // 根据云码文档，code 10000 代表成功，data.data 是验证码结果
                // 注意：不同平台返回结构可能不同，这里基于用户提供的示例进行推断
                // 用户示例只打印了 response.data，这里我们尝试解析并填入
                if (res.code === 10000) {
                    const code = res.data.data;
                    console.log("识别成功，验证码:", code);
                    
                    const captchaInput = document.getElementById("adminValidateCode") as HTMLInputElement;
                    if (captchaInput) {
                        captchaInput.value = code;
                        // 触发 input 事件以确保 Vue/React 等框架能检测到变化（如果有的话）
                        captchaInput.dispatchEvent(new Event('input'));

                        // 自动点击保存按钮
                        const saveButton = document.getElementById("sb1") as HTMLButtonElement;
                        if (saveButton) {
                            console.log("验证码已填入，正在自动保存...");
                            // 稍微延迟一下，让人眼能看到验证码填进去了
                            setTimeout(() => {
                                saveButton.click();

                                // 处理确认弹窗 (jBox)
                                // 轮询查找确认按钮，因为弹窗是异步的
                                const checkConfirmInterval = setInterval(() => {
                                    // 查找 value="ok" 且 class 包含 jbox-button 的按钮
                                    const confirmBtn = document.querySelector('button.jbox-button[value="ok"]') as HTMLButtonElement;
                                    if (confirmBtn) {
                                        console.log("检测到确认弹窗，自动点击确定...");
                                        confirmBtn.click();
                                        clearInterval(checkConfirmInterval);
                                    }
                                }, 200);

                                // 设置超时清除定时器，防止死循环 (例如5秒后还没弹窗)
                                setTimeout(() => clearInterval(checkConfirmInterval), 5000);

                            }, 500);
                        }
                    }
                } else {
                    console.warn("识别失败或 Token 无效:", res.msg);
                }
            } catch (e) {
                console.error("解析响应失败", e);
            }
        },
        onerror: function (error) {
            console.error("请求云码 API 发生错误", error);
        }
    });
};

/**
 * 功能2：智能填充评估页面
 */
const autoFillSmart = () => {
    let radioCount = 0;
    let textCount = 0;

    // --- 1. 客观打分题 (矩阵单选) ---
    const scoreRadios = document.querySelectorAll<HTMLInputElement>('input[type="radio"][value="5"]');
    scoreRadios.forEach(radio => {
        radio.click();
        radio.checked = true;
        radioCount++;
    });

    // --- 2. 智能主观题填充 ---
    const textAreas = document.querySelectorAll('textarea');
    textAreas.forEach(area => {
        const parentDiv = area.parentElement;
        const labelDiv = parentDiv?.previousElementSibling;
        const questionText = labelDiv ? labelDiv.textContent || "" : "";

        let fillText = "";

        if (questionText.includes("花费多少小时") || questionText.includes("每周")) {
            fillText = "4-6小时";
        } else if (questionText.includes("改进") || questionText.includes("意见")) {
            fillText = "课程设置合理，老师讲解透彻，暂无改进建议。";
        } else if (questionText.includes("兴趣") || questionText.includes("参与之前")) {
            fillText = "在选修之前对该领域非常感兴趣，希望建立系统的知识体系。";
        } else if (questionText.includes("参与度") || questionText.includes("出勤")) {
            fillText = "出勤率100%，课堂上紧跟老师思路，积极参与讨论。";
        } else if (questionText.includes("喜欢什么") || questionText.includes("最喜欢")) {
            fillText = "最喜欢老师的授课方式，理论联系实际，深入浅出，让我受益匪浅。";
        } else {
            const comments = [
                "老师治学严谨，备课充分，对学生严格要求，我们收获很大。",
                "教学内容丰富，重点突出，不仅传授知识，还注重培养科学思维。",
                "老师讲课非常有激情，能够调动学生的积极性，课堂气氛活跃。"
            ];
            fillText = comments[Math.floor(Math.random() * comments.length)];
        }

        if (!area.value || area.value.length < 5) {
            area.value = fillText;
            textCount++;
        }
    });

    // --- 3. 杂项单选与多选 ---
    const allRadios = document.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    const radioGroups = new Set<string>();
    allRadios.forEach(r => radioGroups.add(r.name));
    
    radioGroups.forEach(name => {
        const group = document.getElementsByName(name) as NodeListOf<HTMLInputElement>;
        let hasChecked = false;
        for (let i = 0; i < group.length; i++) {
            if (group[i].checked) hasChecked = true;
        }
        if (!hasChecked && group.length > 0) {
            group[0].click();
            group[0].checked = true;
            radioCount++;
        }
    });

    const checkboxes = document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    checkboxes.forEach((cb, index) => {
        if (!cb.checked) {
             if (index < 2) { 
                 cb.click();
                 cb.checked = true; 
             }
        }
    });

    // --- 4. 聚焦验证码 ---
    const captchaInput = document.getElementById("adminValidateCode");
    const captchaImg = document.getElementById("adminValidateImg");

    if (captchaInput) {
        captchaInput.focus();
        captchaInput.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    if (captchaImg && captchaImg instanceof HTMLImageElement) {
        // 高亮验证码图片，方便用户快速定位
        captchaImg.style.border = "2px solid #ff4d4f";
        captchaImg.style.boxShadow = "0 0 8px rgba(255, 77, 79, 0.6)";

        // 获取 Base64 并打印到控制台
        const base64 = getBase64Image(captchaImg);
        if (base64) {
            console.log("验证码 Base64 已获取 (请在控制台查看):", base64);
            // 调用识别接口
            if (YM_TOKEN) {
                identifyCaptcha(base64);
            } else {
                console.warn("未配置云码 Token，跳过自动识别。请在代码中设置 YM_TOKEN。");
            }
        }
    }

    return { radioCount, textCount };
};

// --- Event Handlers ---

const handleFindCourses = () => {
    const list = findEvaluatableCourses();
    
    // 过滤出真正需要评估的课程 (排除 "修改评估")
    const pendingList = list.filter(item => item.isPending);

    if (pendingList.length > 0) {
        const firstCourse = pendingList[0];
        console.log("Pending courses:", pendingList);
        statusText.value = `发现 ${pendingList.length} 门待评课程，正在跳转至: ${firstCourse.courseName}`;
        statusColor.value = 'green';
        
        // 1秒后自动跳转到第一个待评课程
        setTimeout(() => {
             window.location.href = firstCourse.evaluateLink!;
        }, 1000);
    } else if (list.length > 0) {
        statusText.value = `未发现需"评估"的课程 (仅发现 ${list.length} 门"修改评估")`;
        statusColor.value = '#666';
    } else {
        statusText.value = "当前页面未发现课程评估列表";
        statusColor.value = '#d9534f';
    }
};

const handleAutoFill = () => {
    const res = autoFillSmart();
    statusText.value = `已自动处理 ${res.radioCount} 个选项，填写 ${res.textCount} 个问答。请手动输入验证码。`;
    statusColor.value = 'green';
};

// --- Dragging Logic ---

const onMouseDown = (e: MouseEvent) => {
  if (!floatWindow.value) return;
  isDragging.value = true;
  offset.value = {
    x: e.clientX - position.value.left,
    y: e.clientY - position.value.top
  };
  e.preventDefault();
};

const onMouseMove = (e: MouseEvent) => {
  if (!isDragging.value) return;
  let newX = e.clientX - offset.value.x;
  let newY = e.clientY - offset.value.y;

  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  const elWidth = floatWindow.value?.offsetWidth || 220;
  const elHeight = floatWindow.value?.offsetHeight || 120;

  newX = Math.max(0, Math.min(newX, windowWidth - elWidth));
  newY = Math.max(0, Math.min(newY, windowHeight - elHeight));

  position.value = { top: newY, left: newX };
};

const onMouseUp = () => {
  isDragging.value = false;
};

onMounted(() => {
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  
  // Initial position adjustment
  position.value = { top: 150, left: Math.max(0, window.innerWidth - 250) };
});

onUnmounted(() => {
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);
});

</script>

<template>
  <div
    id="my-draggable-float-window"
    ref="floatWindow"
    :style="{ top: position.top + 'px', left: position.left + 'px' }"
  >
    <div
      id="my-draggable-float-window-header"
      @mousedown="onMouseDown"
    >
      SEP 评教助手 (智能版)
    </div>
    <div id="my-draggable-float-window-content">
      <button 
        v-if="isEvalPage" 
        id="btn-auto-fill" 
        class="sep-btn" 
        @click="handleAutoFill"
      >
        一键全选好评 + 填充
      </button>
      <button 
        v-else 
        id="btn-find-courses" 
        class="sep-btn" 
        @click="handleFindCourses"
      >
        查找待评价课程
      </button>
      
      <div class="sep-status-text" :style="{ color: statusColor }">
        {{ statusText }}
      </div>
    </div>
  </div>
</template>

<style scoped>
#my-draggable-float-window {
    position: fixed;
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
    margin-top: 5px;
}
</style>
