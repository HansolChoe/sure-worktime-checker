// URL 확인 및 이동 함수
function checkAndRedirect(tabId, url) {
    if (!url) return;
  
    if (!url.includes("https://gw.suresofttech.com/app/ehr/timeline/my")) {
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          const body = document.body;
          if (body) {
            body.innerHTML = `
              <div style="text-align: center; margin-top: 50px;">
                <button id="navigate-button" style="padding: 10px 15px; font-size: 32px;">근태 관리 사이트 이동하기</button>
              </div>
            `;
            document.getElementById("navigate-button").addEventListener("click", () => {
              window.location.href = "https://gw.suresofttech.com/app/ehr/timeline/my";
            });
          }
        }
      });
    }
  }
  
  // 탭 업데이트 이벤트 감지
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete") {
      if (tab.url) {
        chrome.runtime.sendMessage({ type: "URL_UPDATED", url: tab.url })
      }
    }
  });
  
  // 탭 활성화 이벤트 감지
  chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
      checkAndRedirect(activeInfo.tabId, tab.url);
    });
  });
  