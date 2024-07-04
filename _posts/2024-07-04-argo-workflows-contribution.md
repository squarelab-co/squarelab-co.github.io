---
layout: post
title: Argo Workflows, 오해를 넘어 기여하기
date: 2024-07-04T10:00:00+09:00
author: 이성빈
categories:
  - Engineering
og-img: https://squarelab.co/images/blog/argo-workflows-contribution/cover.jpg
img: /images/blog/argo-workflows-contribution/cover.jpg
img-author: /images/blog/author/seongbin.png
---

이전 글이었던 [죽임 당한 컨테이너](https://squarelab.co/blog/argo-exit-status-143/)에서 근본적인 문제를 해결한 것은 아니었습니다.
[`activeDeadlineSeconds`](https://argo-workflows.readthedocs.io/en/latest/walk-through/timeouts/) 가 충분하게 설정되어있었으나, workflow가 재시도될 때 `maxDuration limit exceeded` 로 인해 `exit status 143` 이 발생하는 것이 근본적인 원인이었습니다.<br>
이 글에서는 Argo Workflows 문서를 보면서 어떤 오해를 하고 있었는지, 오해를 방지하기 위해 해당 프로젝트에 어떻게 기여했는지를 소개합니다.

## 1. 어떤 오해를 하고 있었는가?

Argo Workflows의 Documentation을 살펴보면 `activeDeadlineSeconds` 와 `maxDuration` 은 그 역할이 다릅니다.

- `activeDeadlineSeconds`: Workflow가 실행될 수 있는 최대 시간(초 단위). 이 시간이 초과되면, Workflow는 강제로 종료됩니다.

- `maxDuration`: Workflow가 재시도될 때 사용되는 최대 시간(초 단위). 이 시간이 초과되면, 해당 Workflow의 재시도가 중단됩니다.

과거에 `maxDuration`에 대한 설명은 다음과 같았습니다.
<p class="quotes">
<i class="ri-double-quotes-l quote"></i>
MaxDuration is the maximum amount of time allowed for a workflow in the backoff strategy.
<i class="ri-double-quotes-r quote"></i>
</p>
`retryStrategy.backoff` 하위에서 `duration`과 `factor` 값이 같은 depth에서 주어지다보니, maxDuration이 계산되는 과정에서 factor가 반복되서 곱해짐으로인해 값이 너무 커지는 것을 방지하는 역할인가? 하는 오해가 있었습니다.<br>
이 오해는 Argo Workflows 코드를 직접 확인하는 것으로 풀리게 되었습니다.

```go
// workflow/controller/operator.go
	if retryStrategy.Backoff != nil {
		maxDurationDeadline := time.Time{}
		// Process max duration limit
		if retryStrategy.Backoff.MaxDuration != "" && len(childNodeIds) > 0 {
			maxDuration, err := parseStringToDuration(retryStrategy.Backoff.MaxDuration)
			...
			maxDurationDeadline = firstChildNode.StartedAt.Add(maxDuration)
			if time.Now().After(maxDurationDeadline) {
				woc.log.Infoln("Max duration limit exceeded. Failing...")
				return woc.markNodePhase(node.Name, lastChildNode.Phase, "Max duration limit exceeded"), true, nil
			}
		}
		...
		woc.log.WithField("node", node.Name).Infof("node has maxDuration set, setting executionDeadline to: %s", humanize.Timestamp(maxDurationDeadline))
		opts.executionDeadline = maxDurationDeadline
		...
```

`maxDurationDeadline` 값은 `maxDuration`에 의해 계산됩니다.
그리고 `opts.executionDeadline` 값은 `maxDurationDeadline` 으로 대체되고 있습니다.<br>
즉, `maxDuration` 값은 retry 과정에서 재시작을 기다리는 상한 값으로 사용하는 값이 아니라, workflow가 실행되는 전체 흐름에서 재시작 될 때 사용되는 deadline 값임을 알 수 있었습니다.

## 2. Argo Workflows 프로젝트에 기여하기

처음에는 이게 의도된 동작인지 버그인지 받아들이기 어려웠습니다.
최초에는 버그로 판단하고, Argo Workflows GitHub Repository에 [이슈](https://github.com/argoproj/argo-workflows/issues/13044)를 등록했습니다.
그리고 maintainer들의 반응을 기다려봤습니다. 하지만 이슈에 bug label 만 붙었을 뿐, 별도의 코멘트가 없어서, 직접 버그를 수정하기 시작했습니다.
Argo Workflows의 동작을 로컬에서 확인하기 위해 [Running-Locally 문서](https://github.com/argoproj/argo-workflows/blob/main/docs/running-locally.md)를 참고해서 로컬 환경을 만들고 작업을 진행했습니다.

`maxDurationDeadline` 값이 생성되는 과정과, `executionDeadline`이 override 되는 부분을 [수정](https://github.com/argoproj/argo-workflows/pull/13049)했고, 수정한 코드가 원하는대로 작동하는 것 같았지만, 테스트가 실패했습니다.
실패하는 테스트는 `maxDuration`이 설정되었을 경우 재시도 될 때 `executionDeadline` 값이 `maxDuration` 값으로 설정되어야하는 부분을 확인하게 되었습니다.
이 현상은 버그가 아니라 의도된 기능이라는 것을 이해했습니다.
그래서 다른 사용자들이 저와 동일한 오해를 하지 않기 위한 작업이 필요하다고 생각했습니다.
의도된 구현이더라도, 사용자 입장에서 의도된 건지 알 수 있는 방법이 없어서 `activeDeadlineSeconds`와 `maxDuration`이 함께 사용될 때 의도하지 않은 방식으로 동작할 수 있음을 알리는 것이 필요했습니다.
상대적으로 설명이 부실한 `maxDuration` 을 수정하는 쪽으로 방향을 잡고, 설명을 수정했습니다.

Pod의 Deadline은 최초에 `activeDeadlineSeconds`로 설정되지만, workflow가 실패한 경우, pod의 deadline은 `maxDuration`으로 override 됩니다.
즉, **`maxDuration`은 재시도 될 때 사용되는 deadline으로 이해해야합니다.**

이후, document generate 과정을 거쳐서 [Pull Request](https://github.com/argoproj/argo-workflows/pull/13068)을 제출했고, 테스트가 통과한 이후 머지될 수 있었습니다.

이 과정에서 얻게 된 유익은 여러가지가 있습니다.

1. 사용중인 Workflow Template들 중에서 `activeDeadlineSeconds` 와 `maxDuration`을 함께 사용하는 부분을 제거해서 Workflow가 실패시 재시도가 의도한대로 동작하지 않는 문제를 해결할 수 있었음.
2. Argo Workflows가 어떻게 작동하는지 그 과정을 좀 더 상세히 이해할 수 있었음.
3. Argo Workflows 오픈소스 프로젝트에 기여할 수 있었음.

이후 최초 만든 이슈에서 [제기된 내용](https://github.com/argoproj/argo-workflows/issues/13044#issuecomment-2132453340)은, pending time과 active time을 나누고, `maxDuration`은 pending state에서, `activeDeadlineSeconds`는 active state에서만 사용되는 쪽으로 고려해보려고 한다는 것입니다. 저도 현재 `maxDuration`은 그 의미가 약간 모호해서, pending state에서 사용되는 것이 더 의미가 맞다고 생각합니다.

여전히 비슷한 다른 잠재적인 문제들이 있을 수 있고, 이를 해결하기 위해서는 지속적인 기여가 필요하겠습니다. 특히, 사용자가 이러한 설정을 혼동하지 않도록 문서를 더 명확히 개선하는 것이 중요해보입니다. 앞으로도 이러한 문제들을 해결하기 위해 참여할 예정입니다.
