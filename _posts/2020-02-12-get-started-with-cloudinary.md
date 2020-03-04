---
layout: post
title: Cloudinary를 활용한 이미지 컨텐츠 관리
date: 2020-02-12
author: 추호연
categories: 
- Design
og-img: /images/post/get-started-with-cloudinary/cover.jpg
img: /images/post/get-started-with-cloudinary/cover.jpg
img-author: jamie.jpg
---
새로운 서비스를 만들때 이미지 컨텐츠를 관리하는 것은 디자이너에게 매우 중요한 문제입니다. 디자인이 아무리 잘되어 있어도 컨텐츠가 적절한 퀄리티로 노출되지 않으면 디자인의 품질이 떨어져 보이고 사용자에게 신뢰감을 주기 어렵기 때문입니다.

그렇다고 모든 이미지 컨텐츠를 하나하나 디자이너가 직접 관리하기에는 리소스가 너무 많이 들지요. 이 포스트에서는 스퀘어랩이 Cloudinary를 활용해 어떻게 이미지 컨텐츠를 관리하고 있는지 공유합니다.

## Cloudinary 소개
[Cloudinary](https://cloudinary.com/)는 클라우드 기반의 이미지 및 비디오 관리 서비스입니다. 강력하면서 쉬운 API를 제공하고 있어 조금만 익숙해지면 컨텐츠를 매우 효율적으로 관리할 수 있습니다. 그리고 무엇보다 무료로 시작할 수 있어 스타트업에서 도입하기에 부담이 없습니다.

### 데모 이미지
Cloudinary에 가입하고 이미지를 업로드 하는 것은 어렵지 않습니다. 일반적인 CDN이나 웹서버의 사용법과 유사하죠. 이미지를 업로드하면 고유한 URL을 얻을 수 있는데, 예제로 사용하기 위해 Cloudinary에서 데모로 제공하고 있는 이미지 중에서 고양이 사진을 하나 골라봤습니다. 고양이는 언제나 옳으니까요.
![sofa_cat.jpg](https://res.cloudinary.com/demo/image/upload/sofa_cat.jpg)

    https://res.cloudinary.com/demo/image/upload/sofa_cat.jpg
    
원본은 3940x2540 사이즈에 용량은 1.6MB인 고화질 이미지입니다. 일반적인 웹이나 앱 서비스에서 이런 고화질 이미지를 사용하는 경우는 거의 없습니다. 그래서 상황에 맞게 디자이너들이 직접 이미지를 리사이징하거나 CDN에서 API를 제공하는 경우 API를 통해 동적으로 리사이징해 사용합니다.

### 이미지 리사이징
Cloudinary에서는 URL 파라미터를 통해 쉽게 이미지를 리사이징 할 수 있습니다. 바로 예제를 살펴볼까요.
![sofa_cat.jpg](https://res.cloudinary.com/demo/image/upload/w_400/sofa_cat.jpg) 

    https://res.cloudinary.com/demo/image/upload/w_400/sofa_cat.jpg
    
크고 무거웠던 원본 이미지에서 400x258 사이즈에 용량은 25KB로 줄어든 이미지를 확인할 수 있습니다. URL에서 어떤 부분이 달라졌는지 눈치 채셨나요? `sofa_cat.jpg` 앞에 `width=400`을 의미하는 `w_400` 파라미터를 붙여 원본을 기준으로 비율에 맞게 가로 400px로 줄어든 이미지를 얻을 수 있습니다. CSS로 원본 이미지를 줄여서 표시한게 아니라 jpg 파일 자체의 사이즈와 용량이 줄어들었다는 점이 중요합니다. 

---

![sofa_cat.jpg](https://res.cloudinary.com/demo/image/upload/w_400,h_400/sofa_cat.jpg) 

    https://res.cloudinary.com/demo/image/upload/w_400,h_400/sofa_cat.jpg
    
물론 세로 사이즈도 원하는 대로 지정할 수 있습니다. `height=400`을 의미하는 `h_400` 파라미터를 추가하면 위와 같이 이미지가 표시됩니다. 비율에 맞지 않는 사이즈를 입력했기 떄문에 이미지가 강제로 줄어들어 고양이가 좀 놀란 것 같네요.

### 이미지 크롭핑
원본 비율과 다른 사이즈가 필요할 때는 이미지가 왜곡되어 보이지 않도록 이미지를 크롭해야 합니다. Cloudinary에서는 리사이징과 마찬가지로 URL 파라미터를 통해 쉽게 이미지를 크롭할 수 있습니다.
![sofa_cat.jpg](https://res.cloudinary.com/demo/image/upload/w_400,h_400,c_fill/sofa_cat.jpg) 

    https://res.cloudinary.com/demo/image/upload/w_400,h_400,c_fill/sofa_cat.jpg

`crop to fill`을 의미하는 `c_fill`이 추가되었습니다. 이제 이미지 왜곡없이 400x400으로 이미지를 표시할 수 있게 되었습니다.

---

![sofa_cat.jpg](https://res.cloudinary.com/demo/image/upload/w_400,ar_1:1,c_fill/sofa_cat.jpg) 

    https://res.cloudinary.com/demo/image/upload/w_400,ar_1:1,c_fill/sofa_cat.jpg

세로 길이를 지정하는 대신 비율을 직접 입력할 수도 있습니다. 1:1 비율로 표시하기 위해 `h_400` 대신 `aspect ratio=1:1`을 의미하는 `ar_1:1`을 사용해 볼까요? `h_400`를 추가했을 때와 동일한 결과를 확인할 수 있습니다. `16:9`, `4:3`등 원하는 비율대로 표시할 수 있지요.


### 오브젝트 중심의 이미지 크롭핑
하지만 계속 왼쪽으로 쏠려있는 고양이가 마음 쓰이셨죠? 파라미터를 하나 더 추가해서 이 문제를 해결할 수 있습니다.
![sofa_cat.jpg](https://res.cloudinary.com/demo/image/upload/w_400,h_400,c_fill,g_auto/sofa_cat.jpg) 

    https://res.cloudinary.com/demo/image/upload/w_400,h_400,c_fill,g_auto/sofa_cat.jpg

이번에 추가된 파라미터는 `grtavity`를 `auto`로 적용하는 `g_auto`입니다. 직역하자면 `중력 자동 적용` 정도로 해석할 수 있는데요. Cloudinary에서는 `grtavity` 파라미터로 이미지에 포함된 얼굴이나 사물을 자동으로 인식해 오브젝트를 안정적으로 표시할 수 있는 기능을 제공하고 있습니다. 다양한 오브젝트가 포함된 이미지가 아니라면 인식률도 높아서 사용하는데 무리가 없습니다.

---

![sofa_cat.jpg](https://res.cloudinary.com/demo/image/upload/w_640,h_144,c_fill/sofa_cat.jpg) 

    https://res.cloudinary.com/demo/image/upload/w_640,h_144,c_fill/sofa_cat.jpg
    
한쪽으로 긴 사이즈의 이미지로 `grtavity` 성능을 확인해 볼까요? 위 이미지 처럼 `g_auto` 파라미터가 없으면 이미지의 가운데를 기준으로 크롭핑되어 고양이의 얼굴이 이미지 밖으로 벗어나고 맙니다.   

![sofa_cat.jpg](https://res.cloudinary.com/demo/image/upload/w_640,h_144,c_fill,g_auto/sofa_cat.jpg) 

    https://res.cloudinary.com/demo/image/upload/w_640,h_144,c_fill,g_auto/sofa_cat.jpg

다시 `g_auto` 파라미터를 넣어주면 가로나 세로로 긴 사이즈의 이미지를 요청하더라도 오브젝트를 기준으로 크롭핑 되어 반가운 고양이의 얼굴을 볼 수 있습니다.

### 이미지 최적화

![sofa_cat.jpg](https://res.cloudinary.com/demo/image/upload/w_640,h_144,c_fill,g_auto,q_auto/sofa_cat.jpg) 

    https://res.cloudinary.com/demo/image/upload/w_640,h_144,c_fill,g_auto,q_auto/sofa_cat.jpg
    
마지막으로 `quality=auto`를 의미하는 `q_auto`를 추가해보겠습니다. Cloudinary의 설명에 따르면 이미지 용량과 비주얼 퀄리티 사이에서 최적의 밸런스를 찾아준다고 합니다.
`q_auto`를 추가하기 전 이미지의 용량은 19KB였지만 추가한 후에는 7KB로 크게 줄었습니다. 매의 눈을 가진 분이라면 줄어든 용량 만큼 퀄리티가 다소 낮아진 것을 발견했겠지만 앞서의 설명대로 그렇게 크게 차이 나지는 않습니다.

![sofa_cat.jpg](https://res.cloudinary.com/demo/image/upload/w_640,h_144,c_fill,g_auto,q_auto:best/sofa_cat.jpg) 

    https://res.cloudinary.com/demo/image/upload/w_640,h_144,c_fill,g_auto,q_auto:best/sofa_cat.jpg
    
그럼에도 불구하고 더 나은 퀄리티를 원한다면 `q_auto`에 `best` 옵션을 추가해 가장 좋은 퀄리티로 최적화할 수 있습니다. 용량은 10KB로 늘어났지만 조금 더 나아진 퀄리티를 확인할 수 있습니다.       

---

### 맺음말
지금까지 예제와 함께 Cloudinary를 활용한 이미지 컨텐츠 관리에 대해 살펴보았습니다.

스퀘어랩에서는 하나의 이미지를 여러 화면에서 다른 크기로 표시할 때, 배너 이미지를 다양한 사이즈로 제작할 때 Cloudinary를 적극 사용하고 있습니다. 이를 통해 디자이너들은 이미지를 리사이징하는 반복작업에서 벗어나 더 창조적인 업무에 집중할 수 있었습니다.

Cloudinary에는 위에 언급 된 내용보다 더 많은 기능이 있으니 자세한 내용은 [Get Started with Cloudinary](https://cloudinary.com/documentation/image_transformations)를 참고하세요. 