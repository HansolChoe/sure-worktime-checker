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
            // 초기 결과 출력
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
  
    // 총 근무 시간 합산 (이전 기록)
    let totalSeconds = 0;
    totalTimeElements.forEach((element) => {
      const timeText = element.textContent.trim();
      const timeRegex = /(\d+)h\s*(\d+)m\s*(\d+)s/; // h, m, s 추출
      const match = timeRegex.exec(timeText);
  
      if (match) {
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const seconds = parseInt(match[3], 10);
  
        totalSeconds += hours * 3600 + minutes * 60 + seconds;
        console.log(`hours: ${hours}, minutes: ${minutes}, seconds: ${seconds}`);
      }
    });
  
    // 오늘의 시간 계산
    const todayElement = document.querySelector('.tb_attend_list.today');
    if (todayElement) {
      const attendElement = todayElement.querySelector('.tb_content.attend .txt');
      if (attendElement) {
        // 출근 시간 추출 (중첩 구조 처리)
        const attendTime = attendElement.childNodes[0]?.textContent.trim();
        if (attendTime) {
          const [attendHour, attendMinute, attendSecond] = attendTime.split(':').map(Number);
          console.log(`attendHour: ${attendHour}, attendMinute: ${attendMinute}, attendSecond: ${attendSecond}`);
          const attendDate = new Date();
          attendDate.setHours(attendHour, attendMinute, attendSecond);
  
          const now = new Date();
          totalSeconds += Math.floor((now - attendDate) / 1000); // 현재 시간과 출근 시간 차이
          
        }
      }
    }
  
    // 40시간(144,000초)에서 남은 시간 계산
    const remainingSeconds = Math.max(0, 144000 - totalSeconds);
  
    // 남은 시간, 분, 초 계산
    const remainingHours = Math.floor(remainingSeconds / 3600);
    const remainingMins = Math.floor((remainingSeconds % 3600) / 60);
    const remainingSecs = remainingSeconds % 60;
  
    // 결과 반환
    return `남은 근무 시간: ${remainingHours}시간 ${remainingMins}분 ${remainingSecs}초`;
  }
  