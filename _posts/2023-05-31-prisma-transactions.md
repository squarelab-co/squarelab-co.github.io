---
layout: post
title: Prisma의 트랜잭션 지원 알아보기 + 사용해보기
date: 2023-05-31
author: 진원
categories:
  - Engineering
og-img: https://squarelab.co/images/blog/prisma-transactions/prisma.png
img: /images/blog/prisma-transactions/prisma.png
img-author: /images/Kyte.png
---

서비스 개발을 하다보면 DB의 사용은 거의 필수불가결합니다. 또한 서비스와 그 로직은 점점 복잡해지고 그에 따라 여러 가지 문제를 맞닥뜨리게 되는데, 이 중 몇 가지 패턴은 데이터를 다루는 DB 작업에 트랜잭션(Transaction) 개념을 도입하여 해결할 수 있습니다.

최근에 저희 서비스 Kyte의 쿠폰 기능을 디버깅하면서 발급/사용/검증이 함께 얽힌 복잡한 로직을 개선할 필요가 있었고 여기에 트랜잭션을 도입하였는데, 이에 대한 경험을 간단히 정리 & 공유하고자 합니다.

## 배경

[Prisma](https://www.prisma.io)는 `Next-generation Node.js and TypeScript ORM`, 즉, Node.js/TypeScript를 사용하는 어플리케이션에서 DB와 그에 저장된 데이터에 좀 더 편리하게 접근할 수 있도록 도와주는 컴포넌트입니다.

스퀘어랩에서는 Node.js + TypeScript + NestJS의 기술 스택을 사용하는 백엔드에서 AWS RDS의 MySQL에 접근하기 위해 Prisma를 활용하고 있습니다. 당연히 Prisma가 지원하는 범위 내에서 트랜잭션을 사용해야 했습니다.

## 1차 시도

Java, Spring, MVC에 친숙한 백엔드 개발자의 머릿속에 먼저 떠오른 방법은 [`@Transactional` 어노테이션](https://spring.io/guides/gs/managing-transactions)이었습니다. 간단히 예를 들어보면 다음과 같은 방식의 코드입니다.

```Java
@Service
@Transactional
public class BookingService {

    ...

    @Transactional
    public void createBooking(User user, BookingInfo info) {
        ...
    }
}

```

현재 사용중인 기술 스택의 구성 요소들은 언급한 것들과 다르긴 하지만 개념적인 측면에서의 큰 틀은 비교적 유사했기 때문에, 이에 대응하는 데코레이터를 쉽게 찾을 수 있을 것이라 생각했습니다. 그리고 Prisma 정도의 유명? 라이브러리라면 당연히 비슷한 방식으로 트랜잭션을 지원할 것이라 기대했기 때문입니다.

하지만 `@Transactional` 몇 개 붙이며 살짝 리팩토링하는 수준으로 쉽게 가려던 기대는 완전히 빗나갔습니다. Prisma는 그런 방식으로 트랜잭션을 지원하지 않고, [자신들만의 철학을 가지고 조금은 다른 관점에서 접근](https://www.prisma.io/blog/how-prisma-supports-transactions-x45s1d5l0ww1)하고 있었습니다. 물론 링크된 블로그 포스팅에 업데이트 된 내용처럼 이후 사용자들의 의견을 듣고 받아들여 현재는 조금은 더 친절해진 접근법을 제공하고 있습니다.

## Prisma의 트랜잭션 지원

Prisma(정확히는 Prisma Client)가 [트랜잭션을 지원하는 기술적인 방법](https://www.prisma.io/docs/concepts/components/prisma-client/transactions)을 간단하게 정리하면 아래와 같습니다.

* Nested writes: 서로 관계있는 여러 데이터에 대한 작업을 한 번의 API 호출로 실행하면, 이에 대한 전체 성공/실패를 Prisma가 자동으로 보장
* Batch / bulk transactions: deleteMany, updateMany, createMany 형태의, 한 번에 많은 데이터를 처리하는 API
* The Prisma Client `$transaction` API
    * Sequential operations: 여러 개의 쿼리를 배열로 묶어 인자로 전달하며 호출하고, 이의 순차적인 처리와 전체 성공/실패를 보장
    * Interactive transactions: 사용자의 코드를 포함한 함수 전체를 인자로 넘겨, 트랜잭션 내부에서 별도의 흐름 제어가 가능한 형태

앞 쪽 세 가지 방법은 비교적 간단한 시나리오, 혹은 좀 더 정형화 된 형태로 로직의 동작 및 그 인자를 준비할 수 있는 경우에 간결한 형태로 사용이 가능합니다.

좀 더 복잡하고 세밀한 제어가 필요한 경우 활용할 수 있는, 가장 자유도가 높은 것은 마지막의 **Interactive transactions**입니다. 비교적 최근(4.7.0 버전부터)에 정식 지원 기능으로 추가되었습니다. 마침 가장 따끈따끈한 이 방법이 이번 작업의 시나리오에는 가장 적합해 보였습니다.

## 작업 및 평가

작업한 내용 중 일부를 발췌/간략화 한 내용입니다.

쿠폰을 사용자에게 발급하는 과정에서 여러 가지 제약 조건을 점검하고 문제가 없는 경우에만 최종적으로 발급을 승인하는 구조입니다. 실제로는 트래픽이 몰렸을 때의 동시성 문제라든가 여러 가지 더 고려해야 할 사항들이 많지만, Prisma의 트랜잭션 지원 기능만 집중하여 살펴보기 위해 단순화시켰습니다.

사실 공식 홈페이지에서 제공하는 예제 코드의 형태와 크게 다르지 않습니다. 더 간결한 예시라고 생각하시면 되겠습니다.

`CouponWalletRepository.ts`
```TypeScript
async issue(coupon: Coupon, user: User): Promise<CouponWallet> {
  return await this.prisma.$transaction(async tx => {
    const inserted = await tx.couponWallet.create(...)

    const bindCount = await tx.couponWallet.count(...)
    checkCouponBindLimit(coupon, bindCount)

    const walletsInGroup = await tx.couponWallet.findMany(...).map(...)
    checkCouponGroup(coupon.group, walletsInGroup)

    ...

    return inserted
  })
}
```

이러한 방식으로 작성한 코드를 통해 원하는 바를 달성할 수 있었습니다.

다만 저희는 원래 Repository와 그 내부의 각 함수를 최대한 간결한 형태로 유지하고 복잡한 로직은 Service 레이어에서 처리하는 방식의 코딩 컨벤션을 사용하고 있었는데, 이러한 규칙에 일정 부분 예외가 생겼습니다. 아주 만족스러운 결과라고 하긴 어렵겠습니다.

그리고 개발 및 테스트 도중 [원인 파악이 쉽지 않은 문제](https://github.com/prisma/prisma/issues/13713)도 겪었습니다. 결국 비교적 단순한 Time-out 문제로 확인되었지만, 트랜잭션 적용과 관련하여 Prisma의 지원이 아직은 부족한 부분이 있다고 느꼈습니다.

## 주시할 만한 논의들

Prisma의 트랜잭션 지원이 아직 불편하다고 느끼는 사람들이 더 있는지, 보다 개선된 형태를 요청하는 의견들이 있었습니다.

* [`$transaction` 객체를 외부로 가져올 수 있도록 해서 제어 자유도와 코드 작성의 유연성을 더 높이는 방식](https://github.com/prisma/prisma/issues/12458)
  * [client-extensions](https://www.prisma.io/docs/concepts/components/prisma-client/client-extensions/client)라는 다른 Preview feature와의 결합을 통해 사용할 수 있는 [prototype 코드](https://github.com/prisma/prisma-client-extensions/tree/main/callback-free-itx)가 최근에 나온 상태입니다.
  * 다만 아직은 정식 지원 기능이 아니고 Production 수준에서 사용할 정도는 아니라고 합니다. 그래도 비교적 가까운 시일 내에 기대해 볼 만한 개선점이 아닌가 싶습니다.
* [Decorator를 활용하여 트랜잭션 제어가 가능하도록 하는 방식에 대한 논의](https://github.com/prisma/prisma/issues/13004)
  * 우리?에게 익숙한 Spring 프레임워크나 다른 ORM에서 지원하고 있는 방식입니다.(위의 1차 시도에서 기대했던 바로 그것)
  * 이 방식을 원하는 개발자들이 적지 않은 것 같은데, Prisma의 Contributor는 아직 우선순위가 높지는 않다고 이야기하고 있습니다. 혹시나 이러한 방식을 지원한다 하더라도, 시간이 오래 걸릴 듯 합니다.

## 마무리

Prisma는 ORM이 갖춰야 할 기본에 덧붙여 여러 가지 편리한 기능의 제공과 빠른 발전 속도를 강점으로 지녀, Node.js/TypeScript 백엔드 개발시 함께 사용하기 좋은 라이브러리입니다. 아직 조금 아쉬운 부분들이 여기 저기 보이지만, 개발자들이 열심히 활동하고 있고 사용자들과도 상당히 적극적으로 소통하는 것으로 보여 향후 발전 가능성도 큰 편이라고 생각합니다. 국내에서도 사용자들 사이의 정보 공유가 더 활성화되길 기대합니다.
