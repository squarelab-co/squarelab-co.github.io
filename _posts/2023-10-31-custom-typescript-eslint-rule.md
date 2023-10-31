---
layout: post
title: 말 안 듣는 this, Typescript Custom ESLint Rule로 혼내주기
date: 2023-10-31T23:00:00+09:00
author: 성빈
categories:
  - Engineering
og-img: https://squarelab.co/images/blog/ts-custom-eslint-plugin/cover.png
img: /images/blog/ts-custom-eslint-plugin/cover.png
img-author: /images/blog/author/seongbin.png
---

Nest.JS 기반의 서버를 개발하면서, 코드 작성시 실수 하기 쉬웠던 부분이 있었습니다. Javascript의 `this` 가 예상하지 않은 object를 가리킬 수도 있는 코드를 작성하게 되는 경우였는데요. 특정 경우에 발생할 수 있는 `this` 로 인한 버그를 typescript custom eslint rule을 제작하여 방지해보고자 했습니다.

## Custom Rule 개발의 필요성

아래와 같은 코드를 한번 확인해볼까요?

### 사례 1.

```javascript
class Clock {
  constructor() {
    this.currentTime = "12:00 PM";
  }

  showTime() {
    console.log(this.currentTime);
  }
}

const myClock = new Clock();
setTimeout(myClock.showTime, 1000); // After 1 second, this logs: `undefined`.
```

**사례 1**은 `myClock.showTime` 이라는 함수를 `setTimeout` 이라는 함수의 parameter로 넘겨주는 형태로 인해 생기는 버그입니다.
이를 방지하려면, `setTimeout(() => myClock.showTime(), 1000)` 혹은 `setTimeout(myClock.showTime.bind(myClock), 1000)` 와 같이 `this` 가 호출될 때, 그 context를 잘 찾도록 해줘야합니다.

### 사례 2.

```javascript
class CoffeeMachine {
  constructor(discountTime = 0) {
    this.discountTime = discountTime;
  }

  makeEspresso() {
    console.log("Making Espresso in:", 2 - this.discountTime, "minutes.");
  }

  makeLatte() {
    console.log("Making Latte in:", 5 - this.discountTime, "minutes.");
  }
}

class Barista {
  constructor(machine) {
    this.machine = machine;
    this.coffeeMakingTimeMap = {
      Espresso: this.machine.makeEspresso,
      Latte: this.machine.makeLatte,
    };
  }

  orderCoffee(type) {
    this.coffeeMakingTimeMap[type]();
  }
}

const machine = new CoffeeMachine(1);
const john = new Barista(machine);
john.orderCoffee("Espresso"); // Logs: "Making Espresso in: NaN minutes."
```

**사례 2**는 `Barista` 의 `this.coffeeMakingTimeMap` 에서 `Machine` 의 `makeEspresso` , `makeLatte` 함수 자체를 값으로 주다보니 생기는 버그입니다.
여기서도 `() => this.machine.makeEspresso()` / `() => this.machine.makeLatte()` 와 같이 넘겨주어야 `this` 가 우리가 의도한대로 찾아집니다.

사례 1에서처럼 단순히 `myClock.showTime` 을 인자로 넘겨버리게 되면, `this` 가 브라우저 환경에서는 `window` 객체를, NodeJS 환경에서는 `global` 객체를 가리키게 되어, 예시 코드에서처럼 `undefined` 가 출력되게 됩니다.

Javascript에서는 함수가 어떻게 호출되는지에 따라서 `this`가 동적으로 결정되기 때문에, `Arrow Function` 형태로 호출하면, Lexical Context 안의 `this`를 가지도록 할 수 있습니다.

그래서 원치 않는 동작으로부터 방지하기 위해, 어떤 함수를 함수의 인자로 넘길 때에는, `arrow function` 형태, 혹은 `this`를 명시적으로 바인드 해준 형태로 넘겨주도록 하는 룰을 만들어보기로 했습니다.

---

## ESLint

JS 기반 프로젝트에서는 ESLint 룰을 적용함으로써 프로젝트의 코드 품질을 향상시키고, 코딩 컨벤션을 일치함으로써 팀원간의 협업을 용이하게 할 수 있습니다. 단순히 이런 이점이 있음을 아는 것도 충분하다고 생각하지만, ESLint가 어떤식으로 특정 룰을 검사해내는지 원리를 이해한다면, 우리 팀이나 프로젝트에 알맞는 룰을 만들어낼 수도 있을 것입니다. 그러나, 우리가 주로 사용하는 rule 들은 대부분 이미 만들어져있으므로, 스스로 직접 만들기보다는 기존에 존재하는 규칙을 어떻게 조합해서 사용할 수 있을지 찾아보는 것이 시간을 많이 아낄 수 있을 것입니다.

> ESLint에서 기본적으로 정말 많은 룰을 제공합니다. ([링크](https://eslint.org/docs/latest/rules/))

### AST

우리가 작성한 JS 코드는 V8 엔진의 컴파일러에 의해 파싱 과정을 거쳐 AST(Abstract Syntax Tree)가 생성되고, 이는 바이트 코드로 변환됩니다. 아래 이미지는 [v8 공식 홈페이지에서 바이트코드 컴파일러가 어떻게 작동하는지](https://v8.dev/blog/background-compilation)를 설명한 그림입니다.
![JS AST](https://v8.dev/_img/background-compilation/bytecode.svg)
우리는 프로젝트에서 ESLint를 사용함으로써, V8 엔진이 코드를 컴파일하기 이전에 미리 AST를 만들어보고, 여기서 규칙에 맞지 않는 문법을 검사 해볼 수 있는 것입니다.

[AST Explorer](https://astexplorer.net/) 에서 Javascript 코드를 입력해보면, 우측에 Tree 탭에서 현재 커서가 위치하는 곳이 AST 내부에서 어떤 노드에 해당하는지를 확인해볼 수 있습니다.
위 이미지에서의 예시를 그대로 한번 입력해보겠습니다.

```javascript
function f(a) {
  if (a > 0) {
    return a + 1;
  } else {
    return a - 2;
  }
}
```

그 결과 생성된 AST는 아래와 같이 시작합니다.

```json
{
  "type": "Program",
  "start": 0,
  "end": 83,
  "body": [
    {
      "type": "FunctionDeclaration",
      "start": 0,
      "end": 83,
      "id": {
        "type": "Identifier",
        "start": 9,
        "end": 10,
        "name": "f"
      },
      "expression": false,
      "generator": false,
      "async": false,
      "params": [
        {
          "type": "Identifier",
          "start": 11,
          "end": 12,
          "name": "a"
        }
      ],
      // ...
```

함수를 선언하는 부분의 type은 `FunctionDeclaration` 으로, 그 함수의 이름을 `f` 로 지정하는 부분의 type은 `Identifier` 로, 그리고 이 함수의 parameter의 type은 `Identifier` 이고 그 이름은 `a` 로 잘 파싱되어있네요.

### 이걸로 어떻게 Custom Rule을 만드나요?

우리는 이 구조를 활용해서 우리가 원하는 ESLint Rule을 작성할 수 있습니다.
만약 우리가 "함수의 이름은 반드시 소문자로 시작해야한다" 와 같은 규칙을 만들고 싶다면, 어떤 식으로 이 규칙을 만들어볼 수 있을까요?
AST에서 타입이 `FunctionDeclaration`인 노드를 찾고, 이 노드의 id의 `name`의 첫번째 글자가 소문자인지를 확인하면 될 것입니다.

AST를 탐색하는 과정에는 [`esquery`](https://estools.github.io/esquery/) 를 사용할 수 있습니다. `esquery`는 CSS 셀렉터랑 유사한 문법을 사용해서 AST 노드를 선택하는 것을 가능하게 해줍니다.
그렇다면 우리는 `esquery` 를 사용할 때, Javascript 문법의 각 요소들이 어떤 타입의 노드로 파싱되는지를 알아야할 것입니다. [estree repository](https://github.com/estree/estree/blob/master/README.md) 에서 해당 내용을 확인해볼 수 있습니다.

AST가 어떻게 생성되는지 익숙하지 않으신 분들에게는, 검출해내기 원하는 문법을 [AST Explorer](https://astexplorer.net/) 에 입력해보고, 내가 알고 싶은 부분의 노드 타입이 부모 노드와, 혹은 자식 노드와 어떤 관계에 있는지를 직접 확인해보는게 좋을 것 같습니다.

### esquery

**사례 1**의 코드를 그대로 AST Explorer에 입력해보고, `myClock.showTime` 과 같은 형태가 어떤 type의 Node인지 확인해보면, `CallExpression`의 `argument`들 중에서, `MemberExpression` 으로 선언 되었네요.
esquery로 검출해보려면 다음과 같이 작성할 수 있겠습니다.

```text
CallExpression > MemberExpression
```

이 때, 내가 작성한 esquery가 잘 작동하는지를 확인해보고 싶다면, [이곳](https://estools.github.io/esquery/)에서 JS 코드와, esquery를 작성한 후, 해당 노드가 잘 찾아지는지를 확인해보면 됩니다.

위의 `esquery`에는 함정이 있는데요, 우리가 원한 `myClock.showTime` 뿐만이 아니라, `console.log` 와`this.currentTime` 까지 모두 검출해버렸습니다. ESLint의 한계를 마주하게 되는 지점입니다. Javascript 만으로는 이 이상 검출해낼 수는 없습니다.

만약 Typescript로 코드를 작성했다면, 타입을 활용해서 검출할 수 있으면 좋겠다는 생각이 자연스럽게 드는 지점입니다. 다행히도, Typescript와 ESLint 를 조합하여 룰을 만들어낼 수 있었습니다.

### [Typescript-ESLint](https://github.com/typescript-eslint)

Typescript-eslint 는 ESLint가 Typescript에서도 사용할 수 있도록 하는 플러그인입니다. [typescript-eslint custome rule 문서](https://typescript-eslint.io/developers/custom-rules/) 에서 는 ESLint의 `parser`로 `@typescript-eslint/parser` 를 사용하여 `Typed Rule` 을 작성하는 방법을 확인할 수 있습니다.
기본적으로 `esquery`를 사용하여 원하는 노드를 검출해낸 후에, `@typescript-eslint/utils`의 `ESLintUtils` 를 사용하여 TypeScript의 type checker API 를 호출하는 과정을 거치면 됩니다.
TypeScript는 어떤 식으로 AST를 생성하는지에 대해서는 위에서 나온 AST Explorer와 비슷한 형태인 [TypeScript AST Viewer](https://ts-ast-viewer.com/)를 활용하면서 많은 도움을 받았습니다.

---

## Custom Plugin 개발

ESLint에서 `Rule`은 `Plugin` 안에 포함되어있는 구조입니다. 우리가 만들고 싶은 Rule들을 Plugin안에 집어넣고, 해당 Plugin을 NPM과 같은 사이트에 publish 한다면, 다른 사람들도 우리가 작성한 Rule을 사용할 수 있을거에요.

글 초반부에 나온 **사례 1**과 **사례 2**를 방지하기 위한 Rule을 `no-direct-class-method-passing`, `no-direct-class-method-referencing` 로 각각 명명하여 개발했습니다.
두 가지의 Rule로 나누게 된 이유는, 각각의 사례를 검출해내기 위한 `esquery`가 다르고, 타입을 검사하는 방식도 일부 달랐기 때문이었습니다.

### Custom plugin 구조

최종적으로 구조는 아래와 같습니다.

```
.
├── README.md
├── index.js
├── lib
│   ├── rules
│   │   ├── no-direct-class-method-passing.js
│   │   └── no-direct-class-method-referencing.js
│   └── util.js
├── package.json
├── test
│   ├── fixture
│   │   ├── file.ts
│   │   └── tsconfig.json
│   ├── no-direct-class-method-passing.test.js
│   └── no-direct-class-method-referencing.test.js
└── yarn.lock
```

- `index.js` 에는 플러그인이 어떻게 구성되어있는지를 나타냅니다.

```javascript
module.exports = {
  configs: {
    recommended: {
      plugins: ["tidesquare"],
      parser: "@typescript-eslint/parser",
      parserOptions: { sourceType: "module" },
      rules: {
        "tidesquare/no-direct-class-method-passing": "error",
        "tidesquare/no-direct-class-method-referencing": "error",
      },
    },
  },
  rules: {
    "no-direct-class-method-passing": noDirectClassMethodPassing,
    "no-direct-class-method-referencing": noDirectClassMethodReferencing,
  },
};
```

`configs` 에는 어떤 rule들을 enable 시킬 것인지를 미리 나타낸 조합이라고 보시면 됩니다.
만약 어떤 사용자가 자신의 프로젝트에서 이 플러그인의 `recommended` config를 사용한다면, 각각의 rule을 위반하는 코드가 검출된다면 모두 `error` 인 상태로 사용하겠다는 것을 의미합니다. 꼭 config를 사용하지 않더라도, 각각의 rule을 사용할지 안할지를 명시해주면 됩니다. ([참고](https://eslint.org/docs/latest/use/configure/plugins))

> ESLint plugin의 이름은 `eslint-plugin-XYZ` 와 같이 정의됩니다. 이 플러그인을 프로젝트에서 사용하기 위해서는 `.eslintrc` 와 같은 파일 내의 `plugins` 목록에 `XYZ` 만 추가해도`eslint-plugin-XYZ` 를 사용하는 것으로 인식합니다. ([참고](https://eslint.org/docs/latest/extend/plugins#name-a-plugin))

#### lib/rules

- `lib/rules` 내부에는 사례1, 2 발생을 방지하는 룰에 대한 스펙을 각각 작성했습니다.

- **사례 1**을 방지하는 `no-direct-class-method-passing` Rule의 경우 아래와 같은 형태로 작성했습니다.

```javascript
const { ESLintUtils } = require('@typescript-eslint/utils')
const ts = require('typescript')
const createRule = ESLintUtils.RuleCreator(
  name => `https://www.npmjs.com/package/eslint-plugin-tidesquare`,
)

module.exports.rule = createRule({
  create(context) {
    return {
      CallExpression(node) {
        const services = ESLintUtils.getParserServices(context)
        const typeChecker = services.getTypeAtLocation
          ? services
          : services.program.getTypeChecker()
        node.arguments.forEach(argument => {
          const type = typeChecker.getTypeAtLocation(argument)
          type?.symbol?.declarations.forEach((declaration, i) => {
            if (declaration.kind === ts.SyntaxKind.MethodDeclaration) {
              context.report({
                node: argument,
                messageId: 'noDirectClassMethodPassing',
                fix(fixer) {
                  // 해당 부분을 어떻게 고칠 것인지, fixedCode 생성
                  return fixer.replaceText(node.arguments[i], fixedCode)
                },
	// ...
  },
  meta: {
    // 메타 정보
    messages: {
      noDirectClassMethodPassing: '에러 메시지',
    },
    fixable: 'code',
  },
  defaultOptions: [],
})
```

- `CallExpression`들에 대해, `arguments` 마다 타입이 `MethodDeclaration` 인지를 확인하고, 에러상황임을 `report` 합니다.
- `fix` 옵션이 주어질 경우, `fixedCode`로 해당 부분을 고칠 수 있습니다.

<br/>

> **Typescript로 rule을 제작하지 않은 이유는 아래와 같습니다.**
>
> 1. 프로젝트에서 Type checking이 enable 되었는지 여부에 따라, `ESLintUtils.getParserServices()` 의 내부에 `getTypeAtLocation` / `getSymbolAtLocation` 이 존재하는지 여부를 확인할 수 있는데, 타입 선언 된 파일을 보면 기본적으로 이 함수들이 존재하지 않음을 가정합니다.
> 2. 주어진 context 내에서 node에 접근하는 과정에서 매번 type을 단언해줘야하다보니, Typescript의 강점을 제대로 활용하기 어려웠습니다.

<br/>

- **사례 1**과 비슷한 방식으로, **사례 2** 를 방지하는 Rule을 만들 때 `esquery`는 다음과 같이 작성할 수 있었습니다.
  `CallExpression`이나 `TaggedTemplateExpression` 이 아니면서, children이 `MemberExpression` 인 노드를 골라야합니다.

```
':not(CallExpression, TaggedTemplateExpression) > MemberExpression[property.type="Identifier"]'
```

- 위에서 `TaggedTemplateExpression` 이 있는 이유는, 아래와 같은 코드를 정상이라고 판단하기 위해서 입니다.

```javascript
this.prisma.$excuteRaw`SELECT * FROM database`;
```

### Test 작성

우리가 작성하는 Rule은 Javascript AST 만 검사하는 것이 아니라, type check 까지 해야하기 때문에, Typescript가 실행되는 환경을 제공해야합니다.
`text/fixture/file.ts` 는 아무 내용도 없는 빈 파일입니다. 이 파일에는 테스트 실행시 우리가 테스트 하고 싶은 Typescript 코드가 입력되고, 우리가 작성한 type checking rule을 ESLint가 직접 돌려보는 식으로 테스트가 진행됩니다.

저는 Testing Library로 `mocha`를 선택했고, `mocha`에 의해 테스트를 실행하려면 테스트 코드 파일에 아래와 같은 내용 작성이 필요했습니다.

```javascript
const { RuleTester } = require("@typescript-eslint/rule-tester");
const mocha = require("mocha");

RuleTester.afterAll = mocha.after;
```

> 기존에 프로젝트에서 사용하던 Typescript version을 올릴 수 밖에 없었는데, 5.0 이상으로 버전을 올리게 되면, Nest.JS 프로젝트에서 decorator를 사용하여 의존성을 주입하고 있는 부분의 일부 코드가 깨지는 경우가 생겨서, 4 버전 중 가장 최신 버전으로까지만 올릴 수 있었습니다.

---

## 완성한 Rule의 한계

`this` 가 context 를 잃어버리는 모든 상황을 이제 다 방지할 수 있을 것이다는 희망을 가질 수도 있지만,, 현재 이 Rule에는 한계가 존재하는 상황입니다.

```typescript
const domCancelPnr = this.client.domCancelPnr as (
  request: IDomCancelPnrRequest,
  options: { deadline?: number }
) => Promise<DomCancelPnrResponse>;
```

`this.client.domCancelPnr` 라는 함수의 파라미터 타입을 `as` 키워드를 사용하여 변경하고, 그렇게 변경한 타입의 함수를 사용하는 경우입니다.
`this.client.domCancelPnr` 를 `domCancelPnrV2` 라는 변수로 타입을 재정의하여 사용하려는 의도가 있는 코드입니다. 이는 **사례 2**를 방지하기 위한 `no-direct-class-method-referencing` 룰을 위반하게 됩니다. 이런 경우는 어떻게 처리하면 좋을까요?
`as` 라는 키워드로 타입이 단언되어있을 경우에는 해당 Rule을 위반하지 않도록 rule에 option을 부여하는 식으로 해결할 수도 있을 것이고, 아예 다른 방식으로 구현할 수는 없을까 생각해볼 수도 있겠습니다.

완성된 플러그인은 현재 [이곳](https://www.npmjs.com/package/eslint-plugin-tidesquare) 에서 사용해보실 수 있습니다.
여러분의 프로젝트에서 한번 사용해보시고, 이 Rule에는 어떤 한계가 또 있는지, 다양한 피드백 부탁드립니다!

---

## 참고

- [Typescript eslint 시작하기](https://typescript-eslint.io/getting-started/)
- [ASTs and typescript-eslint](https://typescript-eslint.io/blog/asts-and-typescript-eslint/)
- [V8 엔진 컴파일러](https://v8.dev/blog/background-compilation)
- [Typescript 컴파일러](https://yceffort.kr/2022/05/how-typescript-compiler-works)
