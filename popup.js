function updatePopupContent(url, currentTabId) {
    const contentDiv = document.getElementById("content");
  
    if (url.includes("https://gw.suresofttech.com/login")) {
      contentDiv.textContent = "로그인을 완료 해주세요";
    } else if (url.includes("https://gw.suresofttech.com/app/ehr/timeline/my")) {
      contentDiv.innerHTML = `<div id="timer-container">
                                <p id="timer" style="font-size: 24px; font-weight: bold;">근무 시간 계산 중...</p>
                              </div>`;
  
      // 타이머 업데이트 로직
      chrome.scripting.executeScript(
        {
          target: { tabId: currentTabId },
          func: calculateAndDisplayTime,
        },
        (results) => {
          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError.message);
          } else {
            const timerElement = document.getElementById("timer");
            timerElement.textContent = results[0]?.result || "데이터를 가져오지 못했습니다.";
  
            // 매초 업데이트
            setInterval(() => {
              chrome.scripting.executeScript(
                {
                  target: { tabId: currentTabId },
                  func: calculateAndDisplayTime,
                },
                (updatedResults) => {
                  if (updatedResults && updatedResults[0]?.result) {
                    timerElement.textContent = updatedResults[0].result;
                  }
                }
              );
            }, 1000);
          }
        }
      );
    } else {
      contentDiv.innerHTML = `
        <p>근태관리 사이트 접속하기</p>
        <button id="navigate-button" style="padding: 10px; font-size: 16px;">이동</button>
      `;
  
      document.getElementById("navigate-button").addEventListener("click", () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const currentTabId = tabs[0].id;
          if (currentTabId !== undefined) {
            chrome.tabs.update(currentTabId, { url: "https://gw.suresofttech.com/app/ehr/timeline/my" });
          }
        });
      });
    }
  }
  
  // 초기 로드 시 URL 업데이트
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTabId = tabs[0]?.id;
    const url = tabs[0]?.url;
  
    if (currentTabId && url) {
      updatePopupContent(url, currentTabId);
    }
  });
  
  // 메시지 수신 시 동적 업데이트
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "URL_UPDATED") {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTabId = tabs[0]?.id;
        const url = tabs[0]?.url;
  
        if (currentTabId && url) {
          updatePopupContent(url, currentTabId);
        }
      });
    }
  });
  
  // 계산 및 출력 함수
  function calculateAndDisplayTime() {
    // "total_time" 요소를 모두 가져오기
    const totalTimeElements = document.querySelectorAll('.tb_content.total_time .txt');
    if (!totalTimeElements.length) return '근무 시간 데이터를 찾을 수 없습니다.';
  
    // 총 근무 시간 합산
    let totalMinutes = 0;
    totalTimeElements.forEach((element) => {
      const timeText = element.textContent.trim();
  
      if (timeText && timeText.includes(':')) {
        const [hours, minutes] = timeText.split(':').map(Number);
        if (!isNaN(hours) && !isNaN(minutes)) {
          totalMinutes += hours * 60 + minutes; // 총 분으로 계산
        }
      }
    });
  
    // 40시간(2400분)에서 남은 시간 계산
    const remainingMinutes = Math.max(0, 2400 - totalMinutes);
  
    // 남은 시간, 분, 초 계산
    const remainingHours = Math.floor(remainingMinutes / 60);
    const remainingMins = remainingMinutes % 60;
    const remainingSecs = 59 - new Date().getSeconds(); // 매초 감소
  
    // 결과 반환
    return `남은 근무 시간: ${remainingHours}시간 ${remainingMins}분 ${remainingSecs}초`;
  }
  