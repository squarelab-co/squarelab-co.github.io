---
layout: post
title: Figma 플러그인 만들기
date: 2021-02-23
author: 추호연
categories: 
- Design
og-img: https://res.cloudinary.com/kyte/image/upload/v1613526504/web/post/get-started-with-figma-plugin/cover.png
img: https://res.cloudinary.com/kyte/image/upload/v1613526504/web/post/get-started-with-figma-plugin/cover.png
img-author: https://res.cloudinary.com/kyte/image/upload/web/post/author/jamie.jpg
---

[2020 Design Tools Survey](https://uxtools.co/survey-2020/#ui-design)에서 Figma가 Sketch를 앞지르고 1위에 올랐습니다. 스퀘어랩도 UI 디자인툴로 Sketch를 사용해오다 몇개월 전부터 Figma를 도입했는데요. Sketch와 마찬가지로 Figma에도 유용한 플러그인이 많고, 원하는 기능이 있다면 직접 플러그인을 제작할 수도 있습니다.

<img src="{{site.cloudinary}}/web/post/get-started-with-figma-plugin/tools.png" data-action="zoom">

이 포스트에서는 Figma 플러그인 제작하고 배포하는 과정을 공유하고자 합니다. 코딩에 능숙하지 않은 분들도 따라할 수 있도록 가능한 내용을 풀어썼습니다.

### 플러그인 시작하기

Figma 플러그인 페이지의 In Development 섹션에 새로운 플러그인을 추가합니다. 플러그인 이름을 입력하고 템플릿 선택화면에서 Empty를 선택합니다.

<img src="{{site.cloudinary}}/web/post/get-started-with-figma-plugin/create-a-plugin.png" data-action="zoom">

---

In Development 섹션에 방금 추가한 플러그인이 표시 되었습니다. 플러그인을 클릭하면 해당 폴더가 열리고 `code.js`와 `manifest.json` 파일이 생성된 걸 확인할 수 있습니다. 즐겨쓰는 IDE로 파일을 열어 편집을 시작해 볼게요. 그냥 메모장을 쓰셔도 됩니다.

<img src="{{site.cloudinary}}/web/post/get-started-with-figma-plugin/in-development.png" data-action="zoom">

---

`manifest.json`에는 기본 설정에 관한 내용이 있습니다. 플러그인이 실행될때 UI를 표시하기 위해 `"ui": "ui.html"`를 아래에 추가합니다. id를 변경하면 플러그인이 정상적으로 작동하지 않으니 조심하세요.

~~~
 {
  "name": "Original Size",
  "id": "******************",
  "api": "1.0.0",
  "main": "code.js",
  "ui": "ui.html"
}
~~~

---


`code.js`에는 플러그인의 기능과 관련된 내용을 작성합니다. 기본으로 들어있던 `figma.closePlugin()`는 플러그인을 종료하는 함수이니 잠시 주석 처리하고 아래 내용을 추가합니다.

~~~
//UI를 표시합니다.
figma.showUI(__html__);

//UI 사이즈를 800x600으로 변경합니다.
figma.ui.resize(800, 600);

//플러그인을 종료하는 함수이니 잠시 주석 처리합니다.
//figma.closePlugin();
~~~

---

이제 UI를 표시하기 위해 `ui.html` 파일을 새로 만들고 기본적인 css와 html을 작성합니다.

~~~
<style>
  html {
    margin: 0;
    padding: 0;
    border: 0 none;
  }
  
  body {
    font-family: Sans-serif;
  }
</style>
<div>
  <h2>Hello, world!</h2>
  <p>This is my first plugin.</p>
</div>
~~~

---

아직 아무런 기능이 없는 상태지만 플러그인을 화면에 표시하기 위한 준비를 마쳤으니 한번 실행해볼까요? 메뉴에서 `Plugin > Development > My first plugin`을 선택하면 아래 이미지 처럼 플러그인이 실행되는걸 확인할 수 있습니다.

<img src="{{site.cloudinary}}/web/post/get-started-with-figma-plugin/hello-world.png" data-action="zoom">

### 플러그인에 기능 추가하기

이제부터는 플러그인이 동작할 수 있도록 기능을 추가해 보겠습니다. Sketch에는 이미지를 원본 사이즈로 리셋해주는 Original Size 기능이 있는데요. Figma는 해당 기능을 기본으로 제공하지 않으니 이 기능을 구현해 보겠습니다.

이미 해당 기능을 제공하는 [Restore Image Dimensions](https://www.figma.com/community/plugin/886379932197117140/Restore-Image-Dimensions) 플러그인이 있지만, 우리는 예제를 위해 UI까지 추가해서 구현해보도록 할게요. 

실제 코드는 여러가지 예외 상황을 처리하기 위해 더 복잡하게 작성되어야 겠지만, 예제에서는 사용자가 하나의 레이어만 선택하고 플러그인을 실행한다는 가정하에 가능한 단순하게 작성했습니다.

예제 코드를 모두 이해할 필요는 없습니다. `code.js`와 `ui.html`이 어떻게 데이터를 주고 받는지만 이해하면 여러분이 원하는 플러그인을 만드는데 도움이 될 거에요. `code.js`를 열어 아래 내용으로 코드를 수정합니다.

~~~
//UI를 표시합니다.
figma.showUI(__html__);
    
//UI 사이즈를 800x600으로 변경합니다.
figma.ui.resize(800, 600);
    
//figma.currentPage.selection에는 사용자가 선택한 레이어들이 들어 있습니다. node 변수에 첫번째 레이어를 지정합니다.
const node = figma.currentPage.selection[0];
    
//이미지 정보는 node의 fills안에 들어있습니다. paint 변수에 첫번째 fill을 지정합니다.
const paint = node.fills[0];
    
//Figma는 웹기반이라 이미지 데이터를 비동기로 가져오기 때문에 async & await를 사용합니다.
(async () => {
  //paint.imageHash에는 이미지의 ID가 들어있습니다. figma.getImageByHash()로 이미지를 가져옵니다.
  const image = figma.getImageByHash(paint.imageHash);
  
  //getBytesAsync()는 이미지의 raw bytes를 반환해주는 함수입니다. raw bytes를 bytes 변수에 담습니다.
  const bytes = await image.getBytesAsync();
    
  //figma.ui.postMessage()를 사용해 ui.html로 bytes를 보내줍니다.
  figma.ui.postMessage(bytes);
})();
    
//ui.html에서 보내온 message를 수신합니다.
figma.ui.onmessage = message => {
  //resize()를 사용해 message에 담겨있는 사이즈로 이미지를 리사이징합니다.
  node.resize(message.width, message.height);
    
  //플러그인의 기능이 실행되었으니 플러그인을 종료합니다.
  figma.closePlugin();
}
~~~

---

이제 `ui.html`를 열어 아래 내용으로 코드를 수정합니다.

~~~
<style>
  body {
    font-family: sans-serif;
    font-size: 14px;
  }
    
  .content {
    display: flex;
  }
    
  img {
    max-width: 800px;
    max-height: 536px;
  }
    
  button {
    background-color: rgba(0, 0, 0, 87);
    border: none;
    color: #fff;
    margin: 8px;
    padding: 8px 16px;
  }
</style>
    
<div class="content">
  <!-- 이미지를 정보를 표시할 영역입니다. -->
  <p id="info"></p>
  <!-- 함수를 실행하기 위한 버튼입니다. -->
  <button id="upload">Reset</button>
</div>
<!-- 이미지를 표시할 영역입니다. -->
<div id="gallery"></div>
    
<script>
  //이미지 사이즈를 저장하기 위한 변수입니다.
  let naturalWidth;
  let naturalHeight;
  
  //code.js에서 보내온 message를 수신합니다.
  window.onmessage = async (event) => {
    //code.js에서 받은 이미지 데이터를 bytes 변수에 지정합니다.
    const bytes = event.data.pluginMessage;
    
    //화면에 이미지를 표시하기 위해 img 태그를 생성합니다.
    const img = document.createElement('img');
    
    //이미지 데이터를 img.src에 지정합니다.
    img.src = URL.createObjectURL(new Blob([bytes], {type: 'image/png'}));
    
    //gallery 영역에 img 태그를 추가합니다.
    gallery.appendChild(img);
    
    //이미지를 불러오면 실행될 함수입니다.
    img.onload = function () {
      //불러온 이미지의 실제 사이즈를 변수에 지정합니다.
      naturalWidth = img.naturalWidth;
      naturalHeight = img.naturalHeight;

      //info 영역에 이미지 사이즈를 표시합니다.
      info.innerHTML = "Original Size: " + naturalWidth + "x" + naturalHeight;
    }
  }
    
  //upload 버튼을 클릭하면 window.parent.postMessage()를 사용해 code.js로 이미지 사이즈를 보내줍니다.
  upload.addEventListener('click', function (e) {
    window.parent.postMessage({pluginMessage: {width: naturalWidth, height: naturalHeight}}, '*');
   }, false);
</script>
~~~

---

이제 다시 플러그인을 실행시켜 볼게요. 먼저 이미지를 하나 준비해서 사이즈를 변경합니다. 이미지 레이어를 선택한 후 플러그인을 실행해 Reset 버튼을 클릭하면 이미지가 원본 사이즈로 되돌아 가는 걸 확인할 수 있습니다.

<img src="{{site.cloudinary}}/web/post/get-started-with-figma-plugin/reset.png" data-action="zoom">


### 플러그인 배포하기

플러그인이 완성되었다면 누구나 쓸 수 있도록 플러그인을 배포할 차례입니다. Figma 플러그인 페이지로 돌아와 `Publish new plusin`을 클릭해보세요. 플러그인의 아이콘과 설명을 입력할 수 있는 팝업이 노출됩니다. 모두 입력한 뒤 `Publish`하면 Figma 측의 리뷰를 거친 후 [Figma Community](https://www.figma.com/community?tab=plugins&sort=installs)에 공개됩니다.

<img src="{{site.cloudinary}}/web/post/get-started-with-figma-plugin/publish.png" data-action="zoom">


### 맺음말
지금까지 예제와 함께 Figma 플러그인 만들기에 대해 살펴보았습니다. 스퀘어랩은 반복작업을 줄이고 업무 효율을 높이기 위해 플러그인을 직접 만들어 사용하고 있는데요. 자체 프로젝트를 위한 플러그인이디보니 외부에는 공개할 수 없어 아쉽네요.

Figma는 플러그인 개발자들을 위해 다양한 API를 제공하고 있으니 [Figma Developers](https://www.figma.com/plugin-docs/intro/)에서 자세한 내용을 확인해보세요. 예제와 관련된 내용은 아래에 정리했습니다. 여러분이 직접 플러그인을 만드는 데 도움이 되었으면 합니다.
- [Accessing the Document](https://www.figma.com/plugin-docs/accessing-document/)
- [Making Network Requests](https://www.figma.com/plugin-docs/making-network-requests/)
- [Working with Images](https://www.figma.com/plugin-docs/working-with-images/)
- [figma.ui](https://www.figma.com/plugin-docs/api/figma-ui/)
- [Paint](https://www.figma.com/plugin-docs/api/Paint/)
- [Image](https://www.figma.com/plugin-docs/api/Image/)