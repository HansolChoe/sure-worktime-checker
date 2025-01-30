let timerInterval = null; // 기존 타이머 정리용 변수

function updatePopupContent(url, currentTabId) {
  const contentDiv = document.getElementById("content");
  if (!contentDiv) {
    console.error('Element with id "content" not found');
    return;
  }

  if (url.includes("https://gw.suresofttech.com/login")) {
    contentDiv.textContent = "로그인을 완료 해주세요";
  } else if (url.includes("https://gw.suresofttech.com/app/ehr/timeline/my")) {
    contentDiv.innerHTML = `
      <div id="timer-container">
        <p id="timer" style="font-size: 24px; font-weight: bold;">근무 시간 계산 중...</p>
      </div>`;

    const timerElement = document.getElementById("timer");

    function updateTimer() {
      chrome.scripting.executeScript(
        { target: { tabId: currentTabId }, func: calculateAndDisplayTime },
        (results) => {
          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError.message);
            timerElement.textContent = "시간 계산 중 오류가 발생했습니다.";
            return;
          }
          if (results && results[0]) {
            timerElement.textContent = results[0].result || "시간 계산 데이터를 가져올 수 없습니다.";
          }
        }
      );
    }

    // 기존 타이머가 있으면 제거 후 새로 설정
    if (timerInterval) {
      clearInterval(timerInterval);
    }
    updateTimer(); // 최초 실행
    timerInterval = setInterval(updateTimer, 1000); // 1초마다 갱신
  } else {
    contentDiv.innerHTML = `
      <p>슈어 근태관리 도우미</p>
      <button id="navigate-button" style="padding: 10px; font-size: 16px;">다우오피스 근태관리 페이지로 이동</button>`;

    const navigateButton = document.getElementById("navigate-button");
    if (navigateButton) {
      navigateButton.onclick = () => {
        chrome.tabs.update(currentTabId, { url: "https://gw.suresofttech.com/app/ehr/timeline/my" });
      };
    }
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
  if (document.readyState === "loading") {
    return "DOM이 로드되지 않았습니다. 잠시 후 다시 시도합니다.";
  }

  function getAttendanceTimes() {
    const todayElement = document.querySelector(".tb_attend_list.today");
    if (!todayElement) return null;

    const attendTime = todayElement.querySelector(".tb_content.attend .txt")?.childNodes[0]?.nodeValue.trim();
    const leaveTime = todayElement.querySelector(".tb_content.leave .txt")?.childNodes[0]?.nodeValue.trim();

    return { lastAttendTime: leaveTime || attendTime, now: new Date() };
  }

  function calculateWorkedSeconds(lastAttendTime, now) {
    if (!lastAttendTime) return 0;

    const [attendHour, attendMinute, attendSecond] = lastAttendTime.split(":").map(Number);
    const attendDate = new Date();
    attendDate.setHours(attendHour, attendMinute, attendSecond, 0);

    const lunchStart = new Date();
    lunchStart.setHours(12, 0, 0, 0);

    const lunchEnd = new Date();
    lunchEnd.setHours(13, 0, 0, 0);

    let effectiveStart = attendDate;
    if (attendDate >= lunchStart && attendDate < lunchEnd) {
      effectiveStart = lunchEnd;
    }

    let timeElapsed = Math.floor((now - effectiveStart) / 1000);
    if (attendDate < lunchStart && now >= lunchEnd) {
      timeElapsed -= 3600;
    }

    return Math.max(timeElapsed, 0);
  }

  function totalTimeToSeconds() {
    const todayElement = document.querySelector(".tb_attend_list.today");
    const dayListElement = todayElement ? todayElement.closest(".tb_attend_body") : null;
    if (!dayListElement) return 0;

    const weekAttendLists = dayListElement.querySelectorAll(".tb_attend_list");
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

  function secondsToWork() {
    const todayElement = document.querySelector(".tb_attend_list.today");
    const dayListElement = todayElement ? todayElement.closest(".tb_attend_body") : null;
    if (!dayListElement) return 0;

    const weekHolidayList = dayListElement.querySelectorAll(".day_holiday");
    const numberOfHolidays = weekHolidayList.length;
    const remainingDays = 5 - numberOfHolidays;
    return remainingDays * 8 * 60 * 60;
  }

  const times = getAttendanceTimes();
  if (!times || !times.lastAttendTime) {
    return "출근 기록을 찾을 수 없습니다.";
  }

  const totalSeconds = totalTimeToSeconds() + calculateWorkedSeconds(times.lastAttendTime, times.now);
  const remainingSeconds = Math.max(0, secondsToWork() - totalSeconds);
  const remainingHours = Math.floor(remainingSeconds / 3600);
  const remainingMins = Math.floor((remainingSeconds % 3600) / 60);
  const remainingSecs = remainingSeconds % 60;

  if (remainingSeconds === 0) {
    return "퇴근하세요";
  }

  const now = new Date();
  const lunchMessage = now.getHours() === 12 ? " (점심 시간 12:00~13:00)" : "";
  return `남은 근무 시간:\n ${remainingHours}시간 ${remainingMins}분 ${remainingSecs}초${lunchMessage}`;
}
