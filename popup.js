function updatePopupContent(url, currentTabId) {
  const contentDiv = document.getElementById("content");

  if (url.includes("https://gw.suresofttech.com/login")) {
    contentDiv.textContent = "로그인을 완료 해주세요";
  } else if (url.includes("https://gw.suresofttech.com/app/ehr/timeline/my")) {
    contentDiv.innerHTML = `<div id="timer-container">
                                <p id="timer" style="font-size: 24px; font-weight: bold;">근무 시간 계산 중...</p>
                              </div>`;

    // 매초 업데이트 로직
    const timerElement = document.getElementById("timer");

    const updateTimer = () => {
      chrome.scripting.executeScript(
        {
          target: { tabId: currentTabId },
          func: calculateAndDisplayTime,
        },
        (results) => {
          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError.message);
            timerElement.textContent = "시간 계산 중 오류가 발생했습니다.";
          } else {
            timerElement.textContent = results[0]?.result || "시간 계산 데이터를 가져올 수 없습니다.";
          }
        }
      );
    };

    // 초기 실행 및 주기적 실행
    updateTimer();
    setInterval(updateTimer, 1000); // 매초 업데이트
  } else {
    contentDiv.innerHTML = `
        <p>슈어 근태관리 도우미</p>
        <button id="navigate-button" style="padding: 10px; font-size: 16px;">다우오피스 근태관리 페이지로 이동</button>
      `;
    const navigateButton = document.getElementById("navigate-button");
    navigateButton.addEventListener("click", () => {
      chrome.tabs.update(currentTabId, { url: "https://gw.suresofttech.com/app/ehr/timeline/my" });
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

function calculateAndDisplayTime() {
  // DOM이 로드되지 않은 경우 재시도
  if (document.readyState === 'loading') {
    return 'DOM이 로드되지 않았습니다. 잠시 후 다시 시도합니다.';
  }

  function totalTimeToSeconds() {
    const todayElement = document.querySelector('.tb_attend_list.today');
    const dayListElement = todayElement ? todayElement.closest('.tb_attend_body') : null;
    if (!dayListElement) return 0;

    const weekAttendLists = dayListElement.querySelectorAll('.tb_attend_list');
    let totalSeconds = 0;
    weekAttendLists.forEach((weekAttendList) => {
      const timeString = weekAttendList.textContent.trim();
      const timeParts = timeString.match(/(\d+)h\s(\d+)m\s(\d+)s/);
      if (!timeParts) return;
      const hours = parseInt(timeParts[1], 10);
      const minutes = parseInt(timeParts[2], 10);
      const seconds = parseInt(timeParts[3], 10);
      totalSeconds += hours * 3600 + minutes * 60 + seconds;
    });
    return totalSeconds;
  }

  function todayTimeToSeconds() {
    const todayElement = document.querySelector('.tb_attend_list.today');
    if (todayElement) {
      const attendTime = todayElement.querySelector('.tb_content.attend .txt')?.childNodes[0]?.nodeValue.trim();
      const leaveTime = todayElement.querySelector('.tb_content.leave .txt')?.childNodes[0]?.nodeValue.trim();
      const lastAttendTime = leaveTime ? leaveTime : attendTime;

      if (lastAttendTime) {
        const [attendHour, attendMinute, attendSecond] = lastAttendTime.split(':').map(Number);
        const attendDate = new Date();
        attendDate.setHours(attendHour, attendMinute, attendSecond, 0);

        const now = new Date();

        // Handle lunch break: If last attend time is during or after lunch
        if (attendHour < 12 && now.getHours() >= 13) {
          // Subtract lunch break (1 hour)
          const lunchBreak = 3600; // seconds
          const timeElapsed = Math.floor((now - attendDate) / 1000) - lunchBreak;
          return Math.max(timeElapsed, 0); // Ensure no negative values
        } else if (attendHour >= 12 && attendHour < 13) {
          // If lastAttendTime is during lunch break, adjust to 13:00
          attendDate.setHours(13, 0, 0, 0);
          const timeElapsed = Math.floor((now - attendDate) / 1000);
          return Math.max(timeElapsed, 0);
        } else {
          // General case, no lunch break to subtract
          const timeElapsed = Math.floor((now - attendDate) / 1000);
          return Math.max(timeElapsed, 0);
        }
      }
    }
    return 0; // Default case if no attendance data is found
  }

  const totalSeconds = totalTimeToSeconds() + todayTimeToSeconds();
  const remainingSeconds = Math.max(0, 144000 - totalSeconds);
  const remainingHours = Math.floor(remainingSeconds / 3600);
  const remainingMins = Math.floor((remainingSeconds % 3600) / 60);
  const remainingSecs = remainingSeconds % 60;

  const message = (() => {
    if (remainingSeconds === 0) {
      return '퇴근하세요';
    }
    const now = new Date();
    if (now.getHours() === 12) {
      return `남은 근무 시간:\n ${remainingHours}시간 ${remainingMins}분 ${remainingSecs}초 (점심 시간 12:00~13:00)`;
    }
    return `남은 근무 시간:\n ${remainingHours}시간 ${remainingMins}분 ${remainingSecs}초`;
  })()
  return message;
}
