---
layout: post
title: Serverless한 회사 내부 서비스 만들기
date: 2020-02-04
author: 권영재
categories: 
- Engeeniring
img: krzysztof-kowalik-KiH2-tdGQRY-unsplash.jpg
img-author: author-youngjea.jpeg
color: "#2175FF"
---
사내에서 사용되는 서비스의 경우 대중을 대상으로 하지 않기 때문에 사용량이 많지 않은 경우가 대부분이다. AWS Lambda를 사용하면 비용 절감뿐만 아니라 서버를 직접 관리하고 운영할 필요도 없기때문에 안정적이고 편리하다. Lambda에서는 warm up 전의 첫 호출시 응답이 느린 cold start문제가 있긴하지만 오히려 사내 서비스의 경우 상대적으로 유저경험이 덜 중요하기때문에 cold start시에 잠깐 응답이 느려지는것 정도는 큰 문제가 아니다.

그렇다면 이제 실제로 serverless 형태로 회사 내부 서비스를 만드려면 어떻게 해야하는지 좀더 깊은 고민을 해보도록 하자.




## Serverless framework 소개

AWS Lambda + AWS API Gateway를 이용하여 직접 서버 인스턴스를 띄우지 않고서도 서버 기능을 할 수 있다는 사실은 많이 알려진 사실이다. 하지만 막상 이걸 직접 설정 해보려고 하면 해야할 일이 산더미다. 실제 코드를 작성해서 Lambda에 업로드해야하고, Lambda를 누가 실행 할 수 있는지 적당한 권한을 설정해줘야 하며, API Gateway와 Lambda를 연결해줘야하고, 사용자 지정 도메인도 연결해줘야하며, CloudWatch 로그 설정도 ... (중략). 슬슬 오히려 EC2 인스턴스를 그냥 띄워서 하던대로 하는게 낫지 않을까 생각이 들기 시작한다.

하지만 위와 같은 AWS 웹 콘솔을 통한 복잡하고 반복적인 설정/배포 과정 대신 [serverless framework](https://serverless.com/)를 사용하면 설정 파일 하나로 언제든지 손쉽게 환경 생성/재배포가 가능해지고 해당 설정 내용을 소스 저장소에 올려서 공유 및 변경 내용 추적까지 가능해 진다.

serverless framework CLI를 설치한 후 `serverless.yml` 설정 파일을 만들고 `sls deploy` 명령어만 실행하면 설정파일에 정의된 대로 자동으로 서비스 설정/배포가 된다. (설정 파일의 실제 내용이 궁금한 분들은 글 제일 아래쪽의 `serverless.yml` 샘플 섹션을 참고)

Serverless framework의 경우 내부적으로 AWS CloudFormation 기능을 이용하여 Lambda, API Gateway의 자잘한 설정들을 변경하게되는데, AWS 콘솔을 통해서 변경 가능한 설정 항목들은 serverless framework의 설정파일에서도 거의 지원하고있다고 보면 된다. (심지어 AWS뿐만아니라 Azure, Google Cloud 등의 다른 cloud provider도 지원한다.)

Serverless framework을 이용해서 골치아픈 인프라 설정 문제는 어느정도 해결되었으니, 어떻게하면 회사 내부 서비스에 적합한 구성을 할 수 있을지에 대해서 고민해 보자.



## API Gateway를 어떻게 설정할 것인가?

API Gateway의 경우 원래 Public API만 제공되었는데 2018년 6월 이후로는 설정된 VPC에서만 접근가능하도록 할 수 있는 [Private API 기능](https://aws.amazon.com/ko/blogs/compute/introducing-amazon-api-gateway-private-endpoints/)이 새롭게 제공되기 시작했다.

이 글에서는 AWS Lambda + API Gateway를 조합하여 사내 서비스들에 사용하기 적합한 형태로

1. VPC에서만 액세스 가능한 Private API를 만드는 방법
2. Public API 이지만 Gateway에 API 인증키를 추가해서 접근 제한을 하는 방법

두가지에 대해 알아보고자 한다.

각각에 대해 설명하기 전에 먼저 API Gateway 엔드포인트 유형에따라 어떤 차이점들이 있는지를 먼저 정리해보자.

- Edge (or Edge optimized)
    - CloudFront CDN
    - Public network에서 요청 > CloudFront > API Gateway > Lambda
- Regional
    - CDN없는 일반적인 public API
    - Public network에서 요청 > API Gateway > Lambda
- Private
    - 엔드포인트를 생성한 VPC내에서만 접근 가능
    - Public network에서 요청 > 연결 불가
    - 사용자 VPC내에서 요청 > VPC Endpoint > API Gateway > Lambda
    - 주의: [Private 엔드포인트는 API Gateway에 사용자 지정 도메인 (custom domain) 연결 불가](https://stackoverflow.com/questions/56540149/how-do-i-define-a-custom-domain-name-for-my-amazon-api-gateway-api-with-private)

자신의 현재 Endpoint가 어떤 유형으로 설정 되어있는지 확인하려면 API Gateway의 메인 페이지에 방문해서 API목록 중에서 "엔드포인트 유형" 컬럼을 확인하면 된다.


### 1. Private 엔드포인트를 이용한 내부서비스 구성

API Gateway는 AWS가 관리하는 서비스 (AWS fully-managed) 이기때문에 사용자의 VPC와는 다른 공간에 있다. 때문에
Private 형태로 Endpoint를 만들어 준 경우 API Gateway의 네트워크와 사용자의 VPC가 통신할 수 있도록 허용을 해줘야한다. "VPC Endpoint" 설정이 이 연결을 허용할 수 있도록 해준다.

#### VPC Endpoint 설정 하기

VPC > Endpoint 메뉴로 이동하면 엔드포인트를 추가 할 수 있다. 아래 순서대로 설정해 나가면 된다.

**주의:** 이부분은 serverless.yaml에서 지원하지 않기때문에 AWS 콘솔을 통해서 진행해야한다.

1. VPC > API Gateway 연결
    - VPC Endpoint의 경우 API Gateway뿐만 아니라 AWS의 다른 관리형 서비스들에도 설정해서 사용하는 것이 가능하기때문에 다양한 서비스 목록들이 노출된다. API Gateway와 연결하기 위해서는 `com.amazonaws.{REGION}.execute-api` 을 찾아서 선택하면 된다.
    - ex) com.amazonaws.ap-northeast-1.execute-api

2. VPC 중 어떤 Subnet의 연결을 허용할지 설정
    - 가용 영역별로 연결을 허용할 원하는 subnet을 선택하면 된다.

3. 프라이빗 DNS 이름 활성화

    - "프라이빗 DNS 이름 활성화" 가 되어있으면 기존 Public한 API Gateway > Lambda에서 액세스하던것과 동일한 형태의 URL로 VPC내에서 접근이 가능하다.
        - URL 형식: https://{API_ID}.execute-api.{region}.amazonaws.com
        - ex) https://qb53b9muav2.execute-api.ap-northeast-1.amazonaws.com
    - **주의**: 프라이빗 DNS를 활성화 된 엔드포인트 설정이 완료되면 해당 [VPC에서 사용자 지정 도메인(custom domain)이 설정되지 않은 기존 Public(Edge/Regional) API Gateway로의 API 호출시 HTTP 403 Forbidden 이 발생](https://aws.amazon.com/ko/premiumsupport/knowledge-center/api-gateway-vpc-connections/)한다.
        - 예를들어 VPC내에서 **Regional 또는 Edge**로 설정된 API GW의 엔드포인트인 https://zl5b9muyr1.execute-api.ap-northeast-1.amazonaws.com/prod/example 로 요청시 403 Forbidden 발생
        - 하지만 "API GW Console > 사용자 지정 도메인" 메뉴를 사용하여 위 엔드포인트를 사용자 지정 도메인에 연결 후, VPC내에서 사용자 지정 도메인을 이용한 주소 (https://myservice.com/example)로 요청시  오류가 발생하지 않음
        - 따라서 기존에 Public하게 API Gateway를 사용하는 서비스가 있고, 해당 서비스를 VPC에서 내부에서 호출하고 있다면, VPC엔드포인트를 설정하기 전에 꼭 해당 서비스들에 사용자 지정 도메인을 연결 완료해야 문제가 없다.
        - 이런 현상이 발생하는 원인에 관해서는 [여기](https://st-g.de/2019/07/be-careful-with-aws-private-api-gateway-endpoints)를 참고하면 좋다.


4. 보안그룹 설정 필요
    - VPC Endpoint > API Gateway로 전달되는 요청은 보통 HTTP 요청이니 inbound 443, 80 포트를 허용하는 보안그룹을 추가해 주면 된다. 별도로 다른 프로토콜이나 포트를 사용하고있다면 해당 포트를 허용하도록 설정해주면 된다.

**주의**: VPC Endpoint의 경우 **생성 후 사용하지 않더라도 계속 요금이 발생**한다. 자세한 내용은 글 마지막의 "요금 분석" 섹션을 참고 하면 된다.


#### API Gateway에서 API 생성 하기

API Gateway 콘솔에서 API 생성시 REST API (Private) 으로 되어있는것을 선택해서 생성하면 된다.

`serverless.yml`를 사용할 경우 provider.endpointType 항목을 `private` 으로 설정한다.

#### 특정 VPC에서만 접근되도록 설정

여러개의 VPC를 사용중인경우 그중 원하는 VPC에서만 Internal API가 호출되도록 허용하고 싶은 경우가 있다. 이경우 API Gateway의 리소스 정책 메뉴에서 "소스 VPC 화이트리스트" 버튼을 눌러 정책 템플릿을 로드한 후 원하는 vpcID만 넣어주면 된다.  API GW의 경우 "리소스 정책" 설정 변경 후 항상 deploy를 눌러줘야 반영이 되니 주의해야 한다.

`serverless.yml` 를 사용할 경우 provider.resourcePolicy에 해당 정책을 yaml형태로 넣어주면 된다.

#### 참고 1: VPN 연결을 통해서 VPC의 내부의 Private API 접근하기

 위에서 살펴봤듯이 VPC Endpoint 설정시 프라이빗 DNS 이름을 활성화 한 경우 https://zl5b9muyr1.execute-api.ap-northeast-1.amazonaws.com 주소로 VPC 내부서버에서는 API call이 가능하다. VPC 내부 서버에서 nslookup을 수행하면 다음과같이 IP resolve가 잘 되는것을 확인 할 수 있다.

    ubuntu@ec2-instance:/$ nslookup https://zl5b9muyr1.execute-api.ap-northeast-1.amazonaws.com
    Server:    127.0.0.53
    Address:  127.0.0.53#53

    Non-authoritative answer:
    https://zl5b9muyr1.execute-api.ap-northeast-1.amazonaws.com  canonical name = execute-api.ap-northeast-1.amazonaws.com.
    Name:  execute-api.ap-northeast-1.amazonaws.com
    Address: 172.31.86.18
    Name:  execute-api.ap-northeast-1.amazonaws.com
    Address: 172.31.2.179

비슷하게도 VPC내에 위치한 VPN 서버를 통해 VPN연결을 하게되면 VPC내부에 있는것과 동일하게 간주되서 Private API를 호출하는것이 가능해진다. (반대로 말하면 VPN연결 없이는 개발자의 컴퓨터에서 Private API를 호출하는것이 불가능하다.)
VPN이 연결된 상태로 nslookup을 수행하면 별다른 설정 없이 위의 VPC내부의 서버에서처럼 동일하게 IP resolve가 잘 된다.

[AWS forum에 올라온 글](https://forums.aws.amazon.com/thread.jspa?threadID=161982)을 보면 DNS forward를 별도로 설정하지 않으면 VPC DNS에 접근이 안된다고 나와있긴한데, 실제로 SoftEther VPN의 기본설정값으로 VPN연결후에 사용했지만 VPC Private 도메인들도 resolve가 잘되는 것을 확인했다.

#### 참고 2: VPC의 Private DNS 접근이 실패하는 경우 트러블 슈팅

혹시 VPN연결의 DNS 설정이 잘못된 경우 VPC내에 존재하는 VPN을 통해서 접근했는데도 DNS Resolve가 되지 않아서 접근이 불가능해지는 경우가 있다.

    yjiq150@local-pc:/$ nslookup zl5b9muyr1.execute-api.ap-northeast-1.amazonaws.com
    Server:    8.8.8.8
    Address:  8.8.8.8#53

    ** server can't find https://zl5b9muyr1.execute-api.ap-northeast-1.amazonaws.com: SERVFAIL

VPN Client의 VPN (L2TP) 연결 설정에서 VPN 서버가 제공한 DNS 정보를 사용하지 않고 별도로 DNS 서버의 주소를 설정해서 DNS설정이 override된 경우 (ex: 8.8.8.8, 4.4.4.4 등의 구글에서 제공하는 DNS를 등록해 두는 경우가 존재) VPC의 private DNS쪽으로 DNS query 가 전달되지 않아서 IP resolve가 실패가 발생한다.

Mac 사용자라면 VPN에 연결된 상태로 경우 네트워크 설정(Network Preference) 메뉴에 들어가서 `VPN L2TP` > `Advanced` > `DNS` 에 접근하여 수동으로 설정된 DNS 서버주소를 모두 삭제하면 문제를 해결할 수 있다.


### 2. Public 엔드포인트 Endpoint를 이용한 내부 서비스 구성

내부에서만 사용하는 API라면 private 엔드포인트를 통해서도 사용하지만, 해당 API가 VPC내부에서도 호출되고 외부에서도 동시에 호출되어야 하는 경우도 종종 있는데 이 경우 private 엔드포인트만으로는 불편하다.

이 경우 API를 Public(Regional/Edge) 엔드포인트 형태로 생성한 후 다음과 같은 옵션들을 이용해서 접근 제어를 할 수 있다.

1. API GW에 API Key를 생성하고, 해당 API Key를 넣어서 호출해야 접근 가능하도록 설정
    - method별로 다른 API Key를 설정 가능
    - 하나의 method에 여러개의 다른 API key를 설정 가능
    - API key 별로 사용량 계획(usage plan)을 할당해서 과도한 호출 제한 가능

2. 단순 허용/비허용만 가능한 인증 외에 더 디테일한 권한 체크를 하려면 API GW에 권한부여자(custom authorizer)를 사용해야한다.
    - 권한 체크용 Lambda 함수를 통해서 조건에따라 접근 허용할지 여부를 결정 가능
    - 별도 Lambda 함수 구현 없이 AWS Cognito의 사용자 풀을 이용해서 가능

3. API GW의 리소스 정책(Resource Policy) 설정을 이용하면 IP기반으로도 whitelist/blacklist 액세스 컨트롤이 가능하다. 하지만 VPC 내부에서 Public 엔드포인트를 호출하는 경우 API GW에 수신된 요청의 IP주소를 확인해 보면 해당 서버의 VPC 내의 private IP가 아닌 public IP 주소이기 때문에 VPC내의 private IP range를 이용한 액세스컨트롤은 불가능 하다. 대신 개별 public IP를 각각 정확히 지정해야하는데, 동적으로 서버가 실행/종료되는 경우라서 IP가 계속 바뀌는 경우라면 설정이 어려워지는 문제가 있다.


**Tip:** API key의 경우 secret에 속하기때문에 보통 소스 저장소에 포함시키지 않는다. secret의 갯수들이 많아지게 되면 별도 파일로 관리하는것이 편리하다. serverless.yml 파일 안에 Lamda의 환경변수(env variable)로 들어갈 secret 값들이 소스 저장소에 포함되지 않도록 외부 파일로 빼는 방법은 [Load secrets from env.yml](https://serverless-stack.com/chapters/ko/load-secrets-from-env-yml.html) 글을 참고하면 된다.


## API Gateway/Lambda 비용 분석 및 최적화

내부서비스를 serverless 형태로 로 기껏 만들어놨는데 직접 EC2 서버를 띄워서 만든것 보다 비용이 과도하게 비싸다면? 그것또한 큰 문제다. 어떻게하면 저렴하게 이용할 수 있고 대략적으로 비용이 얼마나 들지를 한번 분석해보았다.

### 1. API Gateway 비용

[API GW 요금 페이지](https://aws.amazon.com/ko/api-gateway/pricing)

아래 나오는 호출 비용과 VPC Endpoint 비용이 걱정된다면 API GW를 통하지 않고 Lambda를 직접 호출하는 방식을 사용하도록 하자. 대신 직접 호출의 경우 일반적인 HTTP호출이 불가능하고 AWS SDK를 통해서만 호출해야하는 불편함이 있다.

#### 호출 비용

Public/Private API 무관하게 REST API 방식으로 설정된 GW의 경우 월 100만 Request당 $4.25 정도의 비용이 발생한다. 만약 사내 서비스 용도로 사용해서 호출이 그리 많지 않다면 비용은 거의 무시 가능하다.

기존 REST API 방식이 아닌 [2019년 12월에 새로 출시한 HTTP API 방식](https://aws.amazon.com/ko/blogs/compute/announcing-http-apis-for-amazon-api-gateway/)을 사용하면 100만 Request당 $1.29 로 더 저렴하게 사용할 수 있지만 아직 베타버전이고 지원하는 기능의 범위가 조금씩 다르니 잘 살펴보고 적용해야한다.


#### Private API 사용을 위한 VPC Endpoint 비용

[API GW 요금 페이지](https://aws.amazon.com/ko/api-gateway/pricing)를 보면 아래와같은 내용이 있다.

> 프라이빗 API에 대한 데이터 전송 요금은 없습니다. 하지만 Amazon API Gateway에서 프라이빗 API를 사용하는 경우에는 AWS PrivateLink 요금이 적용됩니다

이에따라 API GW 요금과 별도로 VPC 엔드포인트를 생성한 순간 부터 Billing 내역 중 Virtual Private Cloud (VPC) 항목에 아래와같은 요금이 부과된다.

- $0.01 per GB Data Processed by VPC Endpoints
- $0.014 per VPC Endpoint Hour

호출 양이 많지 않다면 데이터 전송요금은 부담이 없겠지만 VPC Endpoint가 생성되어있는것 만으로도 한달에 10달러 정도가 소모되니 주의하자.

#### 사용량 계획(Usage Plan) 적용을 통한 과도한 사용 방지

API GW에서 [사용량 계획](https://docs.aws.amazon.com/ko_kr/apigateway/latest/developerguide/api-gateway-request-throttling.html)을 통해 스로틀(throttle)을 걸어두면 불필요하게 과도한 요청을 차단해서 비용을 절감할 수 있다. 스로틀은 토큰 버킷(Token Bucket) 알고리즘에 기반하여 동작하게 되는데, 사용량 계획의 두가지 설정 항목을 아래 처럼 생각 하면 이해하기 쉽다.

- 버스트(Burst): 버킷의 크기
- 요율(Rate): 단위 시간당 버킷에 토큰이 채워지는 양

[토큰 버킷 동작 방식]

- API GW가 요청 하나를 처리할 때 마다 버킷안에 든 토큰을 하나 소모하게되고, 동시에 시간이 지남에따라 정해진 요율 만큼의 토큰이 다시 버킷에 채워진다.
- 순간적으로 너무 요청이 많이 들어오는 경우 버킷안에 토큰이 모두 소모되게되고 토큰 소진 이후에 발생하는 요청들은 429 Too many Request 오류로 처리된다
- 토큰이 소진되었어도 시간이 지나 요율에 따라 토큰이 채워지는 즉시, 신규 요청들을 정상적으로 처리한다. (채워진 토큰의 양보다 신규 요청들이 많을경우 또 429 오류 발생 가능)
- 요청이 거의 없어서 버킷 안에 토큰이 가득차더라도 버킷 크기(=버스트) 이상으로 토큰이 늘어나지는 않는다.


### 2. Lambda 비용

[Lambda 요금 페이지](https://aws.amazon.com/ko/lambda/pricing/)

Lambda의 경우 월 100만번 호출, 실행소요시간 400,000 GB-초 까지는 프리티어여부와 무관하게 항상 무료로 사용가능하다.

여기서 `GB-초` 라는 단위가 재미있는데, 1GB-초 는 최대 1GB(1024MB)의 메모리를 사용하도록 설정된 Lambda 함수가 1초동안 실행된다는 의미이다. 따라서 동일하게 1초동안 실행된 Lambda 함수여도 메모리 사용량이 512MB로 설정되어있었다면 0.5초 GB-초 만큼을 사용한 것으로 볼 수 있다.

#### Lambda 실행 소요시간 최적화
Lambda 요금페이지를 보면 아래와같은 내용이 있다.

> AWS Lambda 리소스 모델에서 함수에 사용할 메모리 양을 선택하면 이에 비례하여 CPU 용량과 기타 리소스가 할당됩니다. 메모리 크기가 증가하면 함수에 사용할 수 있는 CPU도 그만큼 증가하게 됩니다

즉, Lambda 함수가 512MB의 메모리만 필요로 하더라도 CPU 사용량이 많은 작업을 수행하는 경우 오히려 실행 시간이 1024MB를 할당한 경우보다 2배이상 늘어나 버릴 수 있다. 이런경우 비용을 줄이기 위해 메모리 사용량을 줄였지만, CPU 타임을 할당받지 못하여 오히려 실행 시간이 늘어나서 `GB-초` 관점에서 봤을 때는 비용 효율이 떨어지게 된다.

`GB-초` 비용 최적화를 위해 실제 호출을 처리할 때 사용한 메모리의 양과 요금 부과 시간(Billed Duration) 을 확인하고싶다면 `AWS Lambda > 함수 선택 > 모니터링 탭 선택 ` 으로 진입하여 Recent Invocations 섹션을 보면 된다.

메모리 할당량을 조정하면서 함수가 수행될 때의 요금 부과시간을 확인하면 자신의 함수에 맞는 최적값을 찾아낼 수 있을것이고 이를 통해 비용을 절약 하는것이 가능하다.

Lambda에서의 메모리 할당량과 CPU 리소스 관계에 관한 좀더 자세한 내용은 [여기를 참고](https://engineering.opsgenie.com/how-does-proportional-cpu-allocation-work-with-aws-lambda-41cd44da3cac)하도록 하자.


## FAQ

AWS의 수 많은 서비스들과 설정값들을 보면 어떤 서비스를 어떻게 연결하다 보면 질문이 꼬리에 꼬리를 문다. 실제 사내 서비스를 배포하면서 생겼던 의문점들을 몇가지 정리해보았다.

#### Public 엔드포인트와 연결된 Lambda 내부 코드에서 Private 엔드포인트에 연결된 Lambda를 호출하면 어떻게되나?

    getaddrinfo ENOTFOUND 0pylfo8d60.execute-api.ap-northeast-1.amazonaws.com

위와 같이 DNS resolve 에러가 발생하면서 호출이 불가능 하다.
대신 Lambda 안에서 해당 사용중인 언어의 AWS SDK를 import하여 `lambda.invoke` 메서드를 사용하면 Lambda를 직접 호출하는것은 가능하니 필요하다면 이 방법을 사용하자.

#### Private 엔드포인트에는 사용자 지정 도메인(custom domain)을 연결 할 수 있나?

2020년 1월 현재 AWS API Gateway에서는 지원해 주지 않는다. 꼭 필요한 경우 간단하진 않지만 아래와 같은 방식으로 해결이 가능하긴 하다.

- VPC내부에 Reverse proxy server를 둬서 해당 proxy에 custom domain을 연결 한 후 proxy로 들어온 요청을 Private 엔드포인트로 포워딩 하는 방법
- VPC내부 서버에 `/etc/hosts` 파일을 조작하거나 `dnsmasq`를 이용해서 custom domain이 Private 엔트포인트에 해당하는 주소로 resolve 되도록 하는 방법

#### API GW를 연결하지 않고 Lambda를 실행이 가능한가?

위에서도 언급했듯이 AWS SDK를 통해서 Lambda를 직접 호출할 수 있다. 하지만 일반적인 HTTP client를 통해 Lambda 함수를 실행하려면 API GW가 필수적이다.

#### Lambda를 특정 VPC 컨텍스트 내에서 실행 가능한가?

Lambda에서 VPC 내에서만 접근가능하도록 설정된 다른 AWS 서비스 (ex: EC2, RDS, ElastiCache 등)를 이용하려면
특정 VPC 에서 동작하도록 별도의 설정이 필요하다. Serverless framework을 사용하는 경우 다음 [VPC Configuration](https://serverless.com/framework/docs/providers/aws/guide/functions#vpc-configuration)부분을 읽어보면 된다.


## Serverless.yml Sample

[Serverless.yml Reference for AWS](https://serverless.com/framework/docs/providers/aws/guide/serverless.yml/) 문서를 보면 serverless framework을 이용하여 AWS 서비스들을 설정 할 수 있는 모든 파라메터들이 명시되어있다. 필요한 설정이 있다면 여기를 제일 먼저 찾아보면 된다.

모든 설정을 하나씩 검토하는 수고를 줄이기 위해 일단 스퀘어랩의 내부 서비스를 개발할때 사용했던 `serverless.yml` 파일의 일부를 샘플로 공개한다.

    # app and org for use with dashboard.serverless.com
    app: general
    org: squarelab

    service: noticontrol

    frameworkVersion: "=1.60.1"

    plugins:
      - serverless-domain-manager # API GW 사용자 지정 도메인을 쉽게 설정할 수 있게 해주는 플러그인
    custom:
      # Refer to https://serverless.com/blog/serverless-api-gateway-domain/
      # Checkout results: https://ap-northeast-1.console.aws.amazon.com/apigateway/home?region=ap-northeast-1#/custom-domain-names
      customDomain:
        domainName: ${self:service}.squarelab.co
        basePath: ''
        endpointType: regional
        stage: ${opt:stage}
        createRoute53Record: true

      # Load secrets from env.yml file (NOT included in repo)
      environment: ${file(env.yml)}

    provider:
      name: aws
      runtime: nodejs10.x
      region: ap-northeast-1
      stage: ${opt:stage, 'local'}

      #
      # API Gateway configurations
      #
      # EDGE: Deploy API GW with cloudfront (default value)
      # REGIONAL: Deploy API GW without cloudfront
      # PRIVATE: Deploy private API GW (only accessible within VPC)
      endpointType: REGIONAL
      resourcePolicy:
        - Effect: Allow
          Principal: '*'
          Action: execute-api:Invoke
          Resource:
            - execute-api:/*
      apiKeys:
        - key_name # This will generate an api key on first deploy
      usagePlan:
        quota:
          limit: 500000
          period: MONTH
        throttle: # rq per second
          rateLimit: 5
          burstLimit: 10

      #
      # Lambda Configurations
      #
      memorySize: 256 # Default is 1024MB
      timeout: 4 # Default is 6 seconds (API Gateway maximum is 30)

      #
      # CloudWatch Loggings
      #
      logRetentionInDays: 14 # CloudWatch LogGroup retention period
      tracing:
        apiGateway: false
        lambda: false
      logs:
        restApi:
          accessLogging: false
          executionLogging: false # Configuration which enables or disables execution logging.
          fullExecutionData: false # Log rs/rq on error case (ex: non 2xx status codes)

      environment:
        SLACK_SIGNING_SECRET: ${self:custom.environment.slackSigningSecret}
        SLACK_API_TOKEN: ${self:custom.environment.slackApiToken}

    functions:
      handleSlackMessage:
        handler: handler.handleSlackMessage
        events:
          - http:
              path: message
              method: post
              private: true # This makes API require apiKeys

참고로 [YAML 공식 웹사이트](https://yaml.org/faq.html)에는 `.yaml` 확장자를 추천하고 있지만, 전통적으로 확장자는 3글자를 사용해왔던 컨벤션 때문에 프로젝트에따라 `.yml` 도 많이 사용되고있다. 예를들어 쿠버네티스 설정파일의 경우 `.yaml` 사용하지만, serverless framework의 경우에는 `.yml`을 사용하는 것에 주의하자.


