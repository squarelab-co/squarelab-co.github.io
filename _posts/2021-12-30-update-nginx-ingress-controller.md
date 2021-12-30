---
layout: post
title: nginx ingress controller 무중단 업데이트하기
date: 2021-12-30
author: 권영재
categories:
- Engineering
og-img: https://squarelab.co/images/blog/ingress-nginx/og_cover.jpg
img: /images/blog/ingress-nginx/og_cover.jpg
img-author: /images/blog/author/yjiq150.jpg
---

AWS 상에서 쿠버네티스(k8s) 클러스터를 운영할때 NLB(Network Load Balancer)와 nginx ingress controller 를 조합해서 사용하면 매우 편리합니다.
일단 k8s 클러스터로 들어가는 모든 트래픽을 원하는 하나의 네트워크 로드밸런서로 몰아서 사용이 가능하기 때문에 로드밸런서 비용을 절약 가능하고, 여기에 추가로 nginx에서 제공하는 다양한 기능을 모두 사용할 수 있는 장점이 있습니다.
스퀘어랩에서도 대부분 서비스들이 쿠버네티스 클러스터 위에서 운영되고 있으며 외부에서 클러스터로 들어오는 트래픽은 NLB + nginx ingress controller를 조합해서 처리하고있습니다.

이렇게 사용하다보면 외부에서 클러스터 내부로 들어오는 대부분의 트래픽이 nginx ingress controller 를 통해서 들어올 것이기 때문에 nginx ingress 관련 설정을 변경하거나, 버전을 올리거나 할 때의 작은 실수가 클러스터 내에서 실행중인 모든 서비스에 대한 장애로 이어질 수 있기 때문에 항상 주의해야합니다.

때문에 이 글에서는 nginx ingress controller를 업데이트 할 때 다운 타임 없이 무중단으로 진행하려면 어떻게 해야하는지에 대해서 알아볼 예정입니다.


## 들어가기 전에

nginx기반으로 만들어진 ingress controller는 두가지가 있는데 개발 주체가 완전히 다르지만 설정 방법이 비슷한듯 하면서도 다르기 때문에 헷갈리지 않도록 주의해야합니다. (구글로 nginx ingress를 검색해서 보다보면 커뮤니티 버전과 Nginx Inc 버전의 문서가 검색결과에 섞여 나오는 경우가 많음.)

- 커뮤니티 버전: [https://kubernetes.github.io/ingress-nginx](https://kubernetes.github.io/ingress-nginx)
- Nginx Inc 버전: [https://github.com/nginxinc/kubernetes-ingress](https://github.com/nginxinc/kubernetes-ingress)

이 글에서는 커뮤니티 버전 기준으로 설명할 예정이고 ingress-nginx 라는 명칭으로 통일하여 사용할 예정입니다.

## 단순 업데이트 배포 진행시 발생할 수 있는 문제

기존에 사용중인 ingress-nginx의 버전이 오래되서 새 버전으로 메이저 버전을 몇 단계씩 올린다거나, 서비스 전체에 영향이 갈 것 같은 중요한 설정을 바꿔야하는 상황을 가정해봅시다. 이런 경우 개발 클러스터 환경이 있다면 그쪽에서 테스트 해본 후 운영 클러스터 환경에도 적용할 수 있습니다. 하지만 이렇게 하더라도 개발/운영 환경이 항상 100% 동일할 수는 없기 때문에 문제가 발생할 가능성은 여전히 존재합니다.

게다가 기존에 사용중인 ingress-nginx의  ingress controller pod이 재배포 되는 과정에서 graceful shutdown 문제도 고려해야합니다. Graceful shutdown이란 특정 서버를 종료하기 전에 해당 서버에서 아직 처리중인 요청이 끝나는 것을 기다렸다가(connection draining 이라고 부르기도 함), 모든 요청이 정상 처리되고난 후 서버를 안전하게 종료하는것을 의미합니다. 만약 NLB와 ingress-nginx에 graceful shutdown 관련 설정이 제대로 되어있지 않다면, ingress controller pod에서 실행중인 nginx 프로세스에 SIGTERM과 같은 종료 시그널이 전달되었을 때 처리가 진행중인 요청들이 정상적으로 종료될때까지 충분히 기다리지 못하고 pod이 먼저 종료되어 오류가 발생할 수 있습니다. 심지어 graceful shutdown 설정이 잘 되어있어서 종료 직전에 충분한 시간을 기다려주는 경우에도 ingress controller pod을 재배포 하게되면 종종 커넥션 관련 오류들이 발생하곤 합니다.


## NLB + ingress-nginx 이중화를 이용한 업데이트 시나리오

위에 언급했던 문제들을 겪고싶지 않다면 결국 신규 NLB와 ingress-nginx를 추가로 생성하여 이중화 후에 트래픽을 조금씩 옮겨나가다가 모두 이전이 완료되면 기존 리소스를 제거하는것이 가장 안전한 방법입니다. 요약하면 다음과 같은 스텝으로 진행될 것입니다.

1. 기존 NLB, ingress-nginx를 그대로 유지
2. 신규 NLB, ingress-nginx를 만들어서 이중화
3. DNS 레코드를 이용하여 기존 NLB로 연결되어있던 일부 도메인 혹은 트래픽의 일부를 신규 NLB로 전달되도록 변경
4. 신규 설정에 문제 없는 것이 확인되면 신규 NLB, ingress-nginx로 모든 도메인, 모든 트래픽을 전달되도록 변경
5. DNS 레코드 변경사항이 전파(propagation)가 완료될때까지 충분히 기다린 후 기존 ingress-nginx controller pod으로 더이상 요청이 들어오지 않는 것을 로그로 확인한 후 기존 NLB, ingress-nginx를 삭제

이해하기 쉽게 그림으로 표현해보면 다음과 같습니다.

![현재 상황(변경 전)](/images/blog/ingress-nginx/ingress-nginx-existing.png)
<p>1. 현재 상황(변경 전)</p>

![신규 NLB, ingress-nginx를 추가하여 이중화 한 후 일부 DNS 레코드만 신규 NLB로 변경한 상황(변경 중)](/images/blog/ingress-nginx/ingress-nginx-duplicated.png)
<p>2. 신규 NLB, ingress-nginx를 추가하여 이중화 한 후 일부 DNS 레코드만 신규 NLB로 변경한 상황(변경 중)</p>

![모든 DNS 레코드를 변경하고 이중화되었던 기존 NLB, ingress-nginx를 삭제 완료한 상황(변경 완료)](/images/blog/ingress-nginx/ingress-nginx-migration-done.png)
<p>3. 모든 DNS 레코드를 변경하고 이중화되었던 기존 NLB, ingress-nginx를 삭제 완료한 상황(변경 완료)</p>

그런데 위 시나리오를 보면 "한 클러스터에 ingress-nginx controller가 여러개 생기는데 괜찮은걸까?" 라는 의문점이 들 수 있는데, 결론 부터 말하자면 아무 문제 없습니다.

ingress와 ingress-nginx controller의 동작 방식을 살펴보면서 왜 문제가 없는지 한번 살펴볼까요?

먼저 Ingress 리소스는 보통 아래와 같은 형식으로 정의되고, 여러 사이트를 운영하는 경우 여러개의 Ingress 리소스가 정의될 수 있습니다. 아래 내용 중 `kubernetes.io/ingress.class: nginx` 부분이 바로 어떤 종류의 'ingress controller'를 사용할지를 지정하는 부분입니다.

```
apiVersion: networking.k8s.io/v1beta1
kind: Ingress
metadata:
  name: example-ingress
  annotations:
    kubernetes.io/ingress.class: nginx
spec:
  rules:
    - host: example.com
      http:
        paths:
          - backend:
              serviceName: example-service
              servicePort: http
```

ingress-nginx는 대략 다음과 같은 방식으로 동작합니다.

- kubernetes.io/ingress.class: nginx로 지정된 모든 Ingress 리소스를 읽어들임
- 읽어들인 Ingress 리소스의 어노테이션과 속성을 조합하여 실제 nginx 프로세스에서 사용될 nginx.conf 설정 파일을 자동 생성
- 실행중인 nginx 프로세스에 해당 설정파일을 reload하여 설정 반영

때문에 한 클러스터 내에 여러개의 ingress-nginx controller가 존재하더라도 각 controller가 독립적으로 ingress.class가 nginx인 Ingress 리소스를 읽어들인 후  각자 nginx.conf 파일을 생성하여 ingress-nginx controller pod에 반영하게 됩니다. 이렇게 생성된 각각의 ingress-nginx controller 또한 각각 독립적인 NLB에 연결되어 있기 때문에 서로 영향이 전혀 없습니다.

결국 이 k8s클러스터 안에는 example.com이라는 도메인으로 접속해서 들어온 요청을 처리 할 수 있는 ingress-nginx controller가 독립적으로 두개가 준비되어있는 상황이고,  해당 도메인의 DNS 레코드를 어떤 NLB로 연결해주는지에 따라서 트래픽이 기존 ingress-nginx  controller로 보내질지 신규 ingress-nginx  controller로 보내질지가 결정됩니다.


## 실제로 업데이트 수행하기

이제 업데이트 시나리오에 문제가 없음을 검토해보았으니 실제 명령어를 수행해보도록 합시다.

helm chart를 이용하여 신규 ingress-nginx를 클러스터에 설치해 봅시다(이 글에서는 helm v3.x를 사용합니다). 기존 운영중인 ingress-nginx 와 섞이지 않고 이중화를 하기 위해서 여기서는 `ingress-nginx-new` 라는 namespace를 새로 만들어서 이 namespace에 ingress-nginx를 설치합니다. 편의상 기존 nginx-ingress는 `ingress-nginx-old` 라는 namespace에 설치되어 운영되고있다고 가정합시다.

```
# namespace 생성
$ kubectl create namespace ingress-nginx-new

# ingress-nginx chart를 처음 설치한다면 아래처럼 helm repo를 추가 후 업데이트 필요
$ helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
$ helm repo update

# ingress-nginx 설치
$ helm install --version 3.39.0 \
  -n ingress-nginx-new \
  ingress-nginx ingress-nginx/ingress-nginx \
  -f values.yaml
```

위 명령어에서 사용한 `values.yaml` 파일은 ingress-nginx chart에서 제공되는 기본 설정값을 오버라이드 하기 위해 사용됩니다. 참고로 현재 스퀘어랩에서 실제 사용중인 `values.yaml` 파일의 내용은 다음과 같습니다.

```
## nginx configuration
## Ref: https://github.com/kubernetes/ingress-nginx/blob/main/docs/user-guide/nginx-configuration/index.md
controller:
  replicaCount: 2
  affinity:
    podAntiAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
        - weight: 100
          podAffinityTerm:
            labelSelector:
              matchExpressions:
                - key: app.kubernetes.io/name
                  operator: In
                  values:
                    - ingress-nginx
                - key: app.kubernetes.io/instance
                  operator: In
                  values:
                    - ingress-nginx
                - key: app.kubernetes.io/component
                  operator: In
                  values:
                    - controller
            topologyKey: kubernetes.io/hostname

  ## wait up to n seconds for the drain of connections
  terminationGracePeriodSeconds: 300

  service:
    type: LoadBalancer
    annotations:
      # List of annotations available:
      # https://kubernetes-sigs.github.io/aws-load-balancer-controller/v2.1/guide/service/annotations/
      # Use NLB(Network Load Balancer)
      service.beta.kubernetes.io/aws-load-balancer-type: nlb
      # If proxy-protocol is not enabled in NLB, it causes 'broken header' error in nginx
      # If newly created NLB does not be created with proxy protocol configuration
      # Change it manually: EC2 > Load Balancing > Target Group > Edit > 'Enable proxy protocol v2'
      service.beta.kubernetes.io/aws-load-balancer-proxy-protocol: "*"
  config:
    # This is required to client's IP-based access control (This config allows nlb passes a original client ip to nginx)
    use-proxy-protocol: true
```

위 명령어를 수행하고 난 후 조금 기다리면 자동으로 NLB가 새롭게 생성될 것이고 생성된 NLB는 ingress-nginx-new namespace에 존재하는 ingress-nginx-contoller service에 연결되어있을 것 입니다. 이것으로 NLB, ingress-nginx 이중화가 완료되었습니다.

이제 기존 NLB로 전달되던 트래픽의 일부만 신규 NLB로 보내서 신규 NLB + ingress-nginx 구성에 문제가 없는지를 살펴볼 차례입니다. AWS Route53 또는 자신이 사용중인 도메인 네임 서버 설정페이지로 가서 기존 NLB 주소를 가리키고있던 DNS 레코드 중 일부를 신규 NLB 주소로 변경합니다.  예를들어 example.squarelab.co, squarelab.co, kyte.travel 세가지 도메인이 기존 NLB에 연결되어있을때 example.squarelab.co 도메인만을 신규 NLB로 연결 변경합니다. 이렇게 하면 혹시라도 새로 생성한 NLB 설정에 문제가 있더라도 새롭게 연결 변경한 도메인을 가진 서비스에만 영향이 갈 것이기 때문에 문제 발생시 영향도를 줄일 수 있습니다.

변경 후에 아래 명령어를 이용하여 새로운 요청이 신규 ingress-nginx로 잘 인입되고있는지 로그를 통해 확인해 봅시다.

```
$ stern -n ingress-nginx-new ingress-nginx-controller
```

혹시 stern 명령어가 설치되어있지 않다면 [https://github.com/wercker/stern](https://github.com/wercker/stern) 사이트를 확인하여 설치해야합니다. (stern 명령어는 deployment에 포함된 모든 pod들의 로그를 모아서 볼 수 있어서 매우 편리합니다)

로그를 통해 요청이 신규 ingress-nginx로 잘 들어오고있는 것을 확인하면 차차 다른 DNS 레코드들도 모두 신규 NLB 주소로 변경합니다. 이제 기존 NLB로 연결되어있던 모든 DNS 레코드가 신규 NLB를 가리키도록 변경되었습니다. DNS 변경사항은 캐시 등의 이유로 완전히 전파되는데 시간이 오래 걸릴 수 있습니다. 때문에 넉넉하게 48~72시간 정도는 기존 NLB를 유지하는 것이 안전합니다. 시간이 충분히 지난 후에 기존 ingress-nginx로 요청이 전달되는 것이 있는지 다음 명령어를 통해 확인합니다.

```
$ stern -n ingress-nginx-old ingress-nginx-controller
```

아마 정상적으로 잘 변경이 되었다면 별다른 액세스 로그가 보이지 않을 것이고, 혹시 DNS레코드 변경 중 빼먹은 항목이 있다면 지속적으로 액세스 로그가 있을 수도 있으니 로그를 보고 추가적인 DNS 레코드 수정이 필요한지를 최종 확인합니다. 액세스 로그가 더이상 없다면 이제 기존 NLB, ingress-nginx를 삭제할 차례입니다. 

아래처럼 `helm uninstall` 명령어를 사용하여 `ingress-nginx-old` namespace에 설치된 관련 리소스들을 모두 제거합니다. 

```
$ helm uninstall -n ingress-nginx-old ingress-nginx
```

이 명령어를 실행 하면 기존 NLB가 자동으로 삭제됩니다. 하지만 NLB에 삭제 방지 설정이 걸려있는 경우 자동으로 삭제되지 않을수도 있어서 직접 AWS EC2 콘솔의 로드밸런서 메뉴에서 NLB를 찾아보고 삭제 여부를 꼭 확인하도록 합시다.

이것으로 ingress-nginx의 업데이트를 위한 모든 과정이 종료되었습니다.

## 마무리

이 글에서는 ingress-nginx를 무중단으로 안전하게 업데이트 하기 위한 시나리오와 구체적인 실행 방법에 대해 알아보았습니다. 완전히 동일하지는 않겠지만 이 시나리오를 응용하면 nginx기반의 ingress가 아니더라도 비슷한 방법으로 ingress controller를 업데이트 할 수 있을 것 입니다. k8s 클러스터를 운영하는데 있어서 ingress controller의 역할은 매우 핵심적이기 때문에 항상 업데이트 할 때 서비스 전체 장애가 발생하지 않도록 주의를 기울이도록 합시다.

- 참고자료: https://github.com/kubernetes/ingress-nginx/blob/main/charts/ingress-nginx/README.md#upgrading-with-zero-downtime-in-production

<hr />

[스퀘어랩은 언제나 채용중입니다.](https://squarelabrecruit.notion.site/squarelabrecruit/e8a18d1db1424fbe8a27144af8e48315) 스퀘어랩에 조인해서 여행 기술의 혁신을 함께 해나가실 분을 찾습니다!
