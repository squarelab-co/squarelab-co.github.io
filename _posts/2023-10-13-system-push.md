---
layout: post
title: 신입 개발자의 시스템 푸시 개발기
date: 2023-10-13
author: 조이
categories:
  - Engineering
og-img: https://squarelab.co/images/blog/deview2023/keynote_banner.jpg
img: /images/blog/deview2023/keynote_banner.jpg
img-author: /images/blog/author/joy.jpg
---

입사한지 어느덧 8개월이 훌쩍 지나버린 지금. 신입 개발자는 무엇을 하고 있을까요?
입사 후 맡은 일 중 가장 큰 비중을 차지했던 시스템 푸시에 대해 소개해보려고 합니다.

---

## 시스템 푸시가 왜 필요해?

우선 저희는 앱 푸시를 보내기 위해 Braze라는 플랫폼을 사용하고 있는데요. 기존에 발송되고 있는 푸시의 대부분이 마케팅이나 콘텐츠 팀원 분들이 Braze 대시보드에서 수신할 사용자, 푸시 타이틀 및 메세지, 푸시로 보낼 콘텐츠, 푸시 발송 시간 등을 발송할 때마다 매번 수동으로 설정해주고 있습니다.

하지만 플랫폼에서 제공하는 대시보드에서 푸시를 수신할 사용자들을 설정하는데에는 한계가 존재합니다. 푸시 수신 동의가 켜져있는 사용자에게만 보내는 것과 같은 단순한 조건은 큰 문제가 없겠지만 사용자의 행동 데이터에 기반한 조건이 복잡하게 설정되어야 하거나 플랫폼에는 없고 우리 서버에만 가지고 있는 데이터에 대한 조건이라면 이것은 더이상 대시보드에서 사람이 수동으로 설정할 수 없게 됩니다.

![direct-open-statistics](/images/blog/system-push/direct-open-statistics.png)
위 사진[^1]에서 확인해볼 수 있듯이 다수 사용자보다는 세그먼트별로 분리된 사용자에게, 모두 같은 메세지보다는 동적인 메세지를 보냈을 때 푸시 오픈율이 더 높은 것을 볼 수 있습니다. 실제로 저 또한 다른 앱으로부터 받은 푸시들을 생각해봤을 때, 제가 최근에 관심있게 찾아봤던 것들이나 저에게만 주어지는 관련된 혜택이 푸시로 왔을 때 자주 눌러보는 것 같았습니다.

그래서 저희 서비스에도 사용자의 관심사와 행동에 알맞은 푸시를 발송하기 위해 **타겟 사용자 선정, 푸시 콘텐츠, 발송까지 모두 시스템에서 자동화하는 시스템 푸시**를 개발하게 되었습니다.

---

## 시스템 푸시 어떻게 만들었을까?

시스템 푸시를 발송하기 위한 과정을 크게 다섯 단계로 나눌 수 있는데요.

1. Braze 대시보드에서 발송할 푸시 캠페인 템플릿을 작성한다.
2. 조건에 맞는 푸시 타겟 사용자들과 콘텐츠를 가져온다.
3. 푸시 타이틀 및 메세지를 설정한다.
4. 푸시를 정해진 시간에 스케줄링한다.
5. 일정한 주기로 2~4를 반복할 수 있도록 cron을 돌린다.

각 단계를 아래와 같은 예시 요구사항과 함께 설명드리도록 하겠습니다.
* 같은 호텔의 상세 페이지를 3번 이상 본 사용자에게 해당 호텔의 상세페이지로 랜딩
* 매일 오후 5시에 발송

### 1. Braze 대시보드에서 발송할 푸시 캠페인 템플릿을 작성한다.
API로 트리거될 캠페인을 만드는 과정입니다. 이 글에서는 캠페인 설정시 중요한 부분만 설명하며 캠페인을 만드는 자세한 과정은 Braze에서 제공하는 [가이드라인](https://www.braze.com/docs/user_guide/engagement_tools/campaigns)을 참고하시면 됩니다.

liquid문법으로 `api_trigger_properties`를 설정하게 된다면 API로 트리거할 때 설정하고 싶은 값을 함께 넣어준다면 푸시 발송시에 설정한 값으로 발송되게 됩니다. 이처럼 title, message와 deep link 부분을 아래 사진과 같이 설정해줍니다.
<div class="column-box">
    <img class="column-image" src="/images/blog/system-push/braze-01.png" alt="braze캠페인1">
    <img class="column-image border" src="/images/blog/system-push/braze-02.png" alt="braze 캠페인2">
</div>

### 2. 조건에 맞는 푸시 타겟 사용자들과 콘텐츠를 가져온다.
위에서 설정한 가정에 의하면 아래와 같습니다.

- 푸시 타겟 사용자 : 같은 호텔의 상세 페이지를 3번 이상 본 사용자들
- 푸시 콘텐츠 : 사용자가 3번 이상 본 호텔의 상세페이지

그렇다면 이제 이 정보를 빅쿼리에 적절한 쿼리를 보내 데이터를 가져온 후 적절한 형태로 가공합니다. (여기서 쿼리문이 중요한 것은 아니니 이 부분은 생략하겠습니다.)

```kotlin
val targetData = listOf(
  "조이" to TargetInfo(
      deviceId = "device_id",
      hotelName = "시그니엘 서울",
      deeplink = "deeplink url"
  ),
  ...
)
```

### 3. 푸시 타이틀 및 메세지를 설정한다.

푸시 타이틀에는 사용자 닉네임과, 푸시 메세지에는 각 사용자마다 3번 이상 본 호텔 이름이 들어간다고 가정해봅니다.

아래와 같이 2번에서 가져온 데이터로 각 사용자마다 title과 message, 랜딩할 deeplink까지 넣어 recipients를 만듭니다.
아래 예시 코드는 모든 타겟 사용자에게 같은 타이틀과 메세지를 설정하고 있지만, 유저마다 모두 다른 타이틀과 메세지를 설정할 수 있습니다.
~~(예시에서 사용하는 푸시 타이틀과 메세지는 개발자의 머리에서 나온 문구로, 예시일 뿐입니다.)~~
```kotlin
val recipients = targetData.map { (userName, targetInfo) ->
  BrazeCampaignRecipient(
      externalUserId = targetInfo.deviceId,
      BrazeCampaignTriggerProperties(
          title = "똑똑✊ ${userName}님",
          message = "${targetInfo.hotelName}에 관심이 있으시군요",
          deepLink = targetInfo.deeplink
      )
  )
}
```

### 4. 푸시를 정해진 시간에 스케줄링 한다.

위에서 말씀드린 Braze 플랫폼은 다양한 API를 제공하고 있는데, 여기서 사용할 API는 푸시를 특정한 시간에 보낼 수 있도록 하는 푸시 스케줄링 API를 사용할 것입니다. 자세한 API 스펙은 [여기](https://www.braze.com/docs/api/endpoints/messaging/schedule_messages/post_schedule_triggered_campaigns/)서 확인하시면 됩니다.

```kotlin
brazeApi.postCampaignsSchedule(
  requestBody = CampaignsScheduleRequest(
      schedule = BrazeCampaignSchedule("2023-10-14T17:00:00+09:00"),
      campaignId = campaignId,
      recipients = recipients,  // 3번에서 만든 recipients
      broadcast = false,
  )
)
```
위와 같이 스케줄링을 한 후 시간이 되면 아래와 같이 푸시가 성공적으로 전송된 것을 볼 수 있습니다.
![예시 푸시](/images/blog/system-push/example-push.jpeg)

### 5. 일정한 주기로 2~4를 반복할 수 있도록 cron을 돌린다.
매일 오후 5시에 보내야하므로 매일 오후 5시 전에 돌 수 있도록 cron을 설정합니다.
2~4의 로직을 반복하고 4번의 schedule에 들어가는 푸시 스케줄링 시간만 매일 오후 5시로 설정하면 됩니다.

이렇게 하면 시스템 푸시 개발이 끝났습니다! 이제 위에서 만든 시스템 푸시는 타겟 사용자들에게, 적절한 콘텐츠와 함께 설정한 시간에 자동으로 발송되게 됩니다.

---

## 결과는?
기존에 다수 사용자에게 같은 내용으로 보내는 푸시의 오픈율은 약 2%인 데에 반해, 시스템 푸시의 오픈율은 모수와 콘텐츠 종류에 따라 약간의 차이는 있지만 평균적으로 **약 10% 정도**의 오픈율을 볼 수 있었습니다.

---

## 마무리
아무래도 푸시는 수신한 시점에 가장 많이 열어보기도 하고, 잘못 발송되었을 때 이미 발송된 푸시를 고칠 수 없다보니 제일 처음 만든 시스템 푸시가 실제로 사용자에게 발송되던 시점에는 ‘혹시나 잘못 가면 어쩌지.. 잘 발송되었겠지?🫣’하면서 지켜봤었습니다. 이후에 성공적으로 발송된 것을 확인하고 오픈 수가 올라가는 것을 봤을 때는 정말 뿌듯했었습니다. 사실 아직도 새롭게 만든 시스템 푸시가 사용자들에게 발송될 때면 두근두근거립니다..ㅎㅎ

처음 시스템 푸시를 개발하게 된 건 입사하고 약 3개월쯤이었던 것 같은데요. 그전까지는 코드를 이해하고 조그마한 이슈들을 고치는데 대부분 시간을 보냈었기에 시스템 푸시 개발은 조금은 막막했었던 것 같습니다. 그래도 많은 분의 도움과 그 과정에서 받는 코드 리뷰로 하나둘씩 제가 의도한 대로 코드가 작동하면서 성공적으로 시스템 푸시 개발을 마칠 수 있었던 것 같습니다! 이 글이 시스템 푸시 도입을 고민하거나 개발하고 계시는 분들께 도움이 되었으면 좋겠습니다.


## 각주
[^1]: [push notifications statistics](https://www.businessofapps.com/marketplace/push-notifications/research/push-notifications-statistics/)