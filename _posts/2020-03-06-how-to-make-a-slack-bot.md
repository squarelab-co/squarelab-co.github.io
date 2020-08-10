---
layout: post
title: Google Apps Script를 활용한 Slack Bot 만들기
date: 2020-03-06
author: 추호연
categories: 
- Engineering
og-img: https://res.cloudinary.com/kyte/image/upload/q_auto/v1591931027/squarelab/website/post/how-to-make-a-slack-bot/cover.png
img: https://res.cloudinary.com/kyte/image/upload/q_auto/v1591931027/squarelab/website/post/how-to-make-a-slack-bot/cover.png
img-author: https://res.cloudinary.com/kyte/image/upload/v1591930504/squarelab/website/post/author/jamie.jpg
---
G Suite과 Slack은 스타트업에서 필수로 사용하는 서비스라 해도 과언이 아닙니다. G Suite의 다양한 기능과 쉽게 연동이 가능한 Google Apps Script로 Slack Bot을 만들면 반복작업을 자동화하고 업무효율을 높일 수 있습니다.
오늘은 Apps Script를 활용해 Slack Bot을 만드는 기본적인 내용을 공유하고자 합니다. 


### Google Apps Script
우선 새로운 Apps Script 프로젝트를 만들어야 합니다. G suite 계정의 Google Drive에서 좌측 상단의 New(새로 만들기) 버튼으로 시작하세요.
![google-drive-new.png]({{site.cloudinary}}/v1591931029/squarelab/website/post/how-to-make-a-slack-bot/google-drive-new.png)

---

Apps Script가 만들어지면 아래 코드를 복사해 붙여넣기 합니다. Slack에서 인증을 받기 위한 내용인데 코드에 대한 설명은 Slack App 부분에서 하겠습니다.

    function doPost(e) {
        return ContentService.createTextOutput(JSON.parse(e.postData.contents).challenge);
    }

![google-apps-script-new.png]({{site.cloudinary}}/v1591931029/squarelab/website/post/how-to-make-a-slack-bot/google-apps-script-new.png)

---

코드를 붙여넣기 했으면 메뉴 > Publish > Deploy as web app을 선택합니다. 이때 Slack이 Apps Script에 접근할 수 있도록 팝업 하단의 `Who has access to the app`의 값을 `Anyone, even anonymous`로 선택하고 Deploy합니다.
![google-apps-script-deploy.png]({{site.cloudinary}}/v1591931027/squarelab/website/post/how-to-make-a-slack-bot/google-apps-script-deploy.png)

---

Deploy가 완료되면 `Current web app URL`이 표시됩니다. 곧 필요할테니 미리 복사해두세요.
![google-apps-script-deployed.png]({{site.cloudinary}}/v1591931028/squarelab/website/post/how-to-make-a-slack-bot/google-apps-script-deployed.png)

### Slack App
이제 Slack App을 만들 차례입니다. Slack API 사이트의 [Your Apps](https://api.slack.com/apps) 페이지에서 Create New App 버튼을 클릭하면 아래와 같은 팝업이 열립니다.
App에게 적당한 이름을 지어주고 연결할 Workspace를 선택하세요. App과 Bot의 용어가 혼란스러울 수 있는데 App의 기능 중 하나가 Bot이라고 이해하시면 됩니다.
![slack-api-create-new-app.png]({{site.cloudinary}}/v1591931029/squarelab/website/post/how-to-make-a-slack-bot/slack-api-create-new-app.png)

---

Slack App이 만들어지면 Basic Information 페이지로 이동됩니다. 이제 Slack App과 Apps Script를 연결할 차례입니다. Add features and functionality 섹션의 Event Subscriptions 버튼을 클릭하세요.
![slack-api-basic-information.png]({{site.cloudinary}}/v1591931029/squarelab/website/post/how-to-make-a-slack-bot/slack-api-basic-information.png)

---

Enable Events 스위치를 `On`하면 `Request URL`이 표시되는데 여기에 Apps Script에서 복사해두었던 `Current web app URL`을 붙여넣기 하세요. 이제 눈치채셨겠지만 아까 작성한 코드는 Slack이 보내준 `challenge` parameter를 다시 return해 인증을 받는 내용이었습니다.

코드에 문제가 없고 Deploy도 정상적으로 되었다면 `Verified`가 표시될 겁니다. 이제 Slack App이 추가된 채널에 메시지가 포스팅되면 Event를 수신할 수 있도록 Subscribe to bot events에 `message.channels`를 추가하세요. 
![slack-app-event-subscriptions.png]({{site.cloudinary}}/v1591931030/squarelab/website/post/how-to-make-a-slack-bot/slack-app-event-subscriptions.png)

---

Basic Information으로 돌아와서 이번에는 Add features and functionality 섹션의 Permissions를 선택합니다.
![slack-api-basic-information2.png]({{site.cloudinary}}/v1591931029/squarelab/website/post/how-to-make-a-slack-bot/slack-api-basic-information2.png)

---

이제 Slack App에게 적절한 권한을 주어야 할 차례입니다. OAuth & Permissions에서 스크롤을 내리면 Scopes 섹션을 찾을 수 있습니다. `channels:history`는 먼저 등록한 Event 수신을 위한 필수 권한이라 이미 추가되어 있습니다.

여러분이 만들 Bot 따라 다양한 권한이 필요하겠지만 일단 여기서는 제대로 동작하는지 확인할 용도로 `reactions:write`만 추가했습니다.
![slack-api-scopes.png]({{site.cloudinary}}/v1591931030/squarelab/website/post/how-to-make-a-slack-bot/slack-api-scopes.png)

---

다시 스크롤을 올려 Workspace에 App을 설치해야 합니다. Install App to Workspace 버튼을 클릭하면 Workspace에 App이 설치되고 Bot User OAuth Access Token을 얻게 됩니다. 이것도 곧 필요해질테니 일단 복사해두세요.
![slack-api-install-app.png]({{site.cloudinary}}/v1591931030/squarelab/website/post/how-to-make-a-slack-bot/slack-api-install-app.png)

### Apps Script 업데이트 하기
이쯤되면 뭔가 귀찮아지고 손가락은 command + W에 올라가 있겠지만 거의 다 끝났으니 포기하지 마세요. 다시 Apps Script로 돌아가 코드를 수정할게요. `challenge` parameter를 return하던 코드는 더이상 필요하지 않으니 삭제하고 아래 내용으로 바꿔줍니다.

    function doPost(e) {
      var token = "xxxx-xxxxxxxxx-xxxx";
      var contents = JSON.parse(e.postData.contents);
      var option = {
        'method' : 'post',
        'payload' : {
          'token': token,
          'channel': contents.event.channel,
          'timestamp': contents.event.ts,
          'name': "heavy_check_mark"
        }
      };
      UrlFetchApp.fetch("https://slack.com/api/reactions.add", option);
    }

Slack에서 `message.channels` Event가 수신되면 [예제](https://api.slack.com/events/message.channels)와 같이 데이터를 전달 받습니다.
Slack으로부터 받은 데이터에서 `channel`과 `timestamp`를 사용해 해당 메시지에 체크 이모지를 달아주는 코드입니다. `token`에는 앞서 복사해두었던 `Bot User OAuth Access Token` 값을 넣어주세요.
 
---
    
모두 적용했으면 다시 Deploy 해야합니다. 팝업에서 `Project version`을 `New`로 선택하고 Update 버튼을 클릭합니다. `UrlFetchApp`을 사용했기 때문에 권한을 요청하는 팝업이 열릴텐데 흔쾌히 허용해주세요.
![google-apps-script-update.png]({{site.cloudinary}}/v1591931029/squarelab/website/post/how-to-make-a-slack-bot/google-apps-script-update.png)

### 채널에 Slack App 추가하기
드디어 Slack Bot이 잘 동작하는지 확인할 차례입니다. Slack으로 넘어와 방금 만든 App을 채널에 추가해 보겠습니다. 테스트 채널을 하나 만들고 우측의 Add App 버튼으로 방금 만든 App을 검색해 추가합니다.
![slack-add-app.png]({{site.cloudinary}}/v1591931029/squarelab/website/post/how-to-make-a-slack-bot/slack-add-app.png)

---

자, 이제 테스트 채널에 메시지를 보내보세요. Slack Bot이 메시지를 확인하면 바로 체크 이모지를 붙여줄겁니다!
![slack-add-reaction.png]({{site.cloudinary}}/v1591931028/squarelab/website/post/how-to-make-a-slack-bot/slack-add-reaction.png)

## 맺음말
Apps Script를 활용해 Slack Bot을 만드는 기본적인 내용은 여기까지입니다. 이제 여러분이 직접 필요한 Bot을 만들어 나가면 됩니다. 채널에 올라온 메시지의 내용은 `contents.event.text`에 있으니 적절히 파싱해 필요한 작업을 수행하게 하세요.

    function doPost(e) {
      var token = "xxxx-xxxxxxxxx-xxxx";
      var contents = JSON.parse(e.postData.contents);
      
      if (contents.event.text == "something")
      {
         //Do something!
      }
      
      var option = {
        'method' : 'post',
        'payload' : {
          'token': token,
          'channel': contents.event.channel,
          'timestamp': contents.event.ts,
          'name': "heavy_check_mark"
        }
      };
      UrlFetchApp.fetch("https://slack.com/api/reactions.add", option);
    }
    
스퀘어랩에서도 여러 Slack Bot을 만들어 활용하고 있는데요. 휴가와 리모트 근무를 알리는 leave 채널에서는 Calendar Bot이 메시지를 파싱해 캘린더에 자동으로 일정을 추가해주고 jukebox 채널의 Music Bot은 사무실의 DJ로 활약하고 있습니다.

Slack Bot을 직접 만들지 않더라도 [IFTTT](https://ifttt.com/)나 [Zapier](https://zapier.com/home)을 사용하는 방법도 있는데요. 이런 서비스들을 쓰는 것 보다 직접 만들었을 때의 장점은 자유도가 높고 고도화가 가능하다는 점입니다.
[Apps Script API](https://developers.google.com/apps-script/api)와 [Slack API](https://api.slack.com/)에서 어떤 것들이 가능한지 살펴보세요.