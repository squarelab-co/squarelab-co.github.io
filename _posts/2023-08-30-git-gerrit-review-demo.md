---
layout: post
title: Git + Gerrit, 리뷰 받은 코드를 수정해봅시다. Step-by-step (vs. GitHub)
date: 2023-08-30
author: 진원
categories:
  - Engineering
og-img: https://squarelab.co/images/blog/git-gerrit-review-demo/git-gerrit-review-demo.png
img: /images/blog/git-gerrit-review-demo/git-gerrit-review-demo.png
img-author: /images/Kyte.png
---

온전히 혼자서만 작업하는 경우가 아니라면, 코드 리뷰는 소프트웨어 개발 중 빼놓을 수 없는 과정이라고 할 수 있습니다. 그리고 그 중요도가 점점 커지면서 여러 가지 방법론이나 도구들이 개발되었고, 각 조직의 특성에 맞추어 널리, 다양하게 사용되고 있습니다.

스퀘어랩에서도 당연히 [개발 과정에서 코드 리뷰를 진행](https://squarelab.co/blog/code-review-1)하고, 이를 [중요하고 의미있는 과정으로 여기며 더욱 발전시키기 위해 노력](https://squarelab.co/blog/code-review-2)하고 있습니다.
코드 리뷰를 위한 도구로는 [`Gerrit`](https://www.gerritcodereview.com)을 사용하는데, 코드는 [`Git`](https://git-scm.com) repository에 저장되고, `Gerrit`의 Web UI와 다양한 `Git` 관련 도구들을 통해 이를 관리하기 위한 여러 가지 동작을 수행합니다.

이번 글에서는 리뷰 받은 코드를 수정하고 최종적으로 Repository에 적용하는 과정을 하나하나 따라가면서 살펴보려고 합니다. 리뷰 이후 수정한 코드를 반영하기 위한 과정에 초점이 맞춰져 있습니다.
`Gerrit`과 `Git` CLI를 사용할 예정이며, 널리 쓰이고 있는 서비스인 `GitHub`에서의 과정과도 비교해 보겠습니다. 이후 과정은 `Git`, `Gerrit`, `GitHub` 등에 대해 기본적인 지식은 갖추고 있고, 간단한 사용법에는 이미 익숙한 사용자를 대상으로 합니다.

## 들어가기

기존의 Repository에 새로운 파일들을 추가하고 필요한 내용을 채워넣는 작업을 진행하고 이에 대해 리뷰를 요청한 상황을 가정해 보겠습니다. `Gerrit`의 Web UI에는 다음과 같이 표시되었습니다.

![Gerrit 리뷰 요청 상태](/images/blog/git-gerrit-review-demo/gerrit-review-01.png)

전체 과정을 조금 더 세밀하게 나누었고, 이를 각각 하나의 커밋(`Commit`)으로 반영하였습니다. 각 작업(커밋)들은 먼저 수행된 순서대로 다음과 같습니다.

1. `file1`을 새롭게 추가
2. 기존에 존재하던 `file0`에 내용을 채워넣기
3. 새로 추가했던 `file1`에 내용을 채워넣기
4. 새로 `file2`를 추가하면서 내용도 한 번에 채워넣기
5. 이후 사용할 `file3`을 미리 준비(추가)

큰 작업을 하나의 커밋으로 모아 처리하게 되면 이를 관리/수정하는 사람이나 리뷰하는 사람 모두 부담과 어려움을 갖게 됩니다.
불필요할 정도로 작게 쪼갤 필요까지는 없겠지만, 커밋 하나가 스스로 완결성을 가지는 수준에서 전체 작업을 가능한 한 잘게 쪼개는 편이 이후 과정을 더욱 수월하게 합니다. 여기서는 예시를 위해 실제 작업에서 적용되는 기준보다 좀 더 작은 단위로 커밋들이 작성되었습니다.

이 커밋들은 함께 리뷰를 받기위해 한 번에 `Gerrit`에 제출되었고, 그 중 3개(위의 1, 3, 5번 작업)는 특별한 문제나 의견 없이 리뷰를 통과했으나, 중간의 2개(2, 4번)는 수정이 필요하다는 의견을 받았습니다. 리뷰 내용은 다음과 같이 표시됩니다.

* 2번 "기존에 존재하던 `file0`에 내용을 채워넣기" 작업에 대한 리뷰

    ![Gerrit 리뷰 #1](/images/blog/git-gerrit-review-demo/gerrit-review-02.png)

* 4번 "새로 `file2`를 추가하면서 내용도 한 번에 채워넣기" 작업에 대한 리뷰

    ![Gerrit 리뷰 #2](/images/blog/git-gerrit-review-demo/gerrit-review-03.png)

우측 상단의 `Relation chain`과 `Submitted together` 항목을 통해 리뷰 진행중인 커밋과 다른 커밋들과의 관계를 파악할 수 있습니다.

이제 리뷰 의견이 달린 두 개의 커밋을 검토/수정하여 반영하는 작업을 진행할 차례입니다. 보통은 의견을 주고 받으며 코드의 수정 방향을 결정하고 그에 맞추어 진행하지만, 이번에는 이를 생략하고 특별한 이견 없이 리뷰어의 의견을 따르는 경우를 가정하겠습니다.

## GitHub의 경우

`Gerrit`에서의 본격적인 수정/반영 작업을 진행하기 전에, 현재 가장 널리 쓰이고 있는 협업 도구 중 하나인 `GitHub`의 경우를 살펴보겠습니다. `GitHub`과의 비교를 통해 `Gerrit`에서 진행되는 작업의 이해도를 높일 수 있을 것이라고 생각합니다.

위의 "들어가기" 문단에서 설정한 것과 동일한 상태의 `GitHub` Web UI 구성입니다. 5개의 커밋이 하나의 큰 작업을 이루고 있고, 이 변경 사항에 대해 동일한 리뷰 의견을 받았습니다.

![GitHub 리뷰 요청 상태](/images/blog/git-gerrit-review-demo/github-review-01.png)

이 화면은 하나의 `Pull request`를 종합하여 표시해주고 있는데, `Gerrit`과의 가장 큰 차이가 바로 이 `PR`의 유무입니다. `GitHub`은 리뷰 관리를 위한 자체적인 단위로 `PR`이라는 개념을 사용하고 있는데, 의견 교환 및 코드 검토, 그리고 수정 및 최종 머지 역시 `PR`을 기준으로 처리됩니다.

## GitHub에서 작업하기, Step-by-step

먼저 `GitHub`을 사용하는 경우에는 어떠한 과정을 거치게 되는지 따라가 보겠습니다. 다양한 방법이 존재할 수 있는 과정이므로, 반드시 아래와 같이 진행해야 하는 것은 아닙니다. 일반적으로 많이 사용되는 시나리오 중 하나라고 보시면 되겠습니다.

1. 수정해야할 내용 파악: 추가로 작업이 필요한 부분은 다음과 같습니다.
    - `file0`에 `222` 항목을 추가
    - `file2`의 `123`을 `012`로 변경

2. 실제 수정 작업을 진행합니다. IDE나 텍스트 에디터를 통해 파일의 내용을 수정하고 로컬 환경에 저장합니다. 이 부분에 대한 자세한 예시는 생략하겠습니다.

3. `GitHub`에서는 보통 (기존 커밋은 그대로 유지하고) 수정한 내용을 아예 새로운 커밋으로 쌓아올리면서 변경 내역을 공유/리뷰/관리합니다. 아래 과정을 통해 새로운 커밋을 생성합니다.

4. `222` 항목을 추가한 `file0`를 커밋
    ```bash
    $ git add file0
    $ git commit -m "Insert missing data to file0"
    ```

5. `123`을 `012`로 변경한 `file2`를 커밋
    ```bash
    $ git add file2
    $ git commit -m "Fix wrong data in file2"
    ```

6. `PR`을 진행중인 Remote source repository(`origin`)에 커밋을 반영(Push)
    ```bash
    $ git push origin
    ```

7. `PR`에 추가 작업을 진행했음을 알려(보통은 자동으로 처리됩니다.) 추가적인 리뷰 과정을 진행합니다. 이후 과정은 큰 문제 없이 바로 리뷰를 통과한 경우를 가정하겠습니다.

8. 리뷰어가 추가적인 리뷰를 완료하고 `PR`을 승인
    - 여기까지 진행되면 아래와 같은 상태가 됩니다. `GitHub` 설정 등에 따라 조금 다르게 표시될 수 있습니다.
    - 수정 작업이 신규 커밋으로 추가된 것, 이를 리뷰 과정에 언급한 것, 리뷰어가 확인 후 승인한 것 등을 확인할 수 있습니다.

    ![GitHub 리뷰 완료 상태](/images/blog/git-gerrit-review-demo/github-review-02.png)

9. 화면 하단의 녹색 `Merge pull request` 버튼을 통해 `PR`을 Target branch에 반영하면 전체 작업이 마무리됩니다. 이미 많이 익숙한 과정이라 생각해서 아주 자세한 부분까지 설명하지는 않았습니다.

![GitHub 머지 완료 상태](/images/blog/git-gerrit-review-demo/github-review-03.png)

이렇게 한 다발의 작업이 마무리되었습니다. 여기서는 `PR`이 Merge commit과 함께 Target repository/branch에 합쳐지는 방식으로 처리하였습니다.

## Gerrit에서 작업하기, Step-by-step

`Gerrit`에서의 작업은 방식이 조금 다릅니다. 각 "커밋" 자체가 직접적인 수정 작업 대상이 됩니다.

1. 수정해야할 내용 파악
    - `file0`에 `222` 항목을 추가: 커밋 `1c6798320543bf10066631ccd577e08e4e636c23`을 수정해야 합니다.
    - `file2`의 `123`을 `012`로 변경: 커밋 `b2cdd39e6c800f7db50c5c76c7f0fe689ec732bb`을 수정해야 합니다.

2. 대상 커밋들을 수정할 준비
    - 수정이 필요한 가장 오래된 커밋의 ID는 `1c6798320543bf10066631ccd577e08e4e636c23`입니다.
    - 아래와 같은 명령어를 통해 [리베이스](https://git-scm.com/book/ko/v2/Git-%EB%B8%8C%EB%9E%9C%EC%B9%98-Rebase-%ED%95%98%EA%B8%B0)를 시작합니다. 이 과정에서 수정할 커밋을 지정할 수 있습니다.
        ```bash
        $ git rebase -i 1c6798320543bf10066631ccd577e08e4e636c23^
        ```

    - 다음처럼 텍스트 편집기 화면에 리베이스 대상들이 표시됩니다.
        ```
        pick 1c67983 Fill file0
        pick d273576 Fill file1
        pick b2cdd39 Add & fill file2
        pick 9769909 Prepare file3
        ```

    - 이것을 아래와 같이 변경하고 저장합니다. 리베이스 과정에서 내용을 수정할 커밋들을 골라 `edit`로 마킹합니다.
        ```
        edit 1c67983 Fill file0
        pick d273576 Fill file1
        edit b2cdd39 Add & fill file2
        pick 9769909 Prepare file3
        ```

3. 현 상태를 확인해보면 아래와 같은 정보를 확인할 수 있습니다. Interactive 리베이스 과정에 진입한 상태로, `edit`로 지정된 커밋마다 멈추어 내용 수정이 가능한 상태가 됩니다.
    ```bash
    $ git status
    ```
    ```
    interactive rebase in progress; onto 230ad8a
    Last command done (1 command done):
       edit 1c67983 Fill file0
    Next commands to do (3 remaining commands):
       pick d273576 Fill file1
       edit b2cdd39 Add & fill file2
      (use "git rebase --edit-todo" to view and edit)
    You are currently editing a commit while rebasing branch 'master' on '230ad8a'.
      (use "git commit --amend" to amend the current commit)
      (use "git rebase --continue" once you are satisfied with your changes)

    nothing to commit, working tree clean
    ```

4. `file0`에 `222` 항목을 추가(파일 내용 변경 과정은 생략)하고 기존 커밋에 반영합니다. 커밋 메시지는 변경하지 않았습니다.
    ```bash
    $ git add file0
    $ git commit --amend --no-edit
    ```

5. 다음 커밋 수정을 위해 리베이스 과정을 진행시킵니다.
    ```bash
    $ git rebase --continue
    ```

6. `file2`의 `123`을 `012`로 변경(파일 내용 변경 과정은 생략)하고 기존 커밋에 반영합니다. 커밋 메시지는 변경하지 않았습니다.
    ```bash
    $ git add file2
    $ git commit --amend --no-edit
    ```

7. 다시 한 번 리베이스 과정을 진행시킵니다. 고치기로 한 두 개의 커밋을 모두 수정 완료한 이후이므로 리베이스 작업이 완료된 상태가 됩니다.
    ```bash
    $ git rebase --continue
    ```

8. 다시 리뷰 요청을 해서 `Gerrit`에 변경사항이 반영되도록 합니다.
    ```bash
    $ git review
    ```
    ```
    You are about to submit multiple commits. This is expected if you are
    submitting a commit that is dependent on one or more in-review
    commits, or if you are submitting multiple self-contained but
    dependent changes. Otherwise you should consider squashing your
    changes into one commit before submitting (for indivisible changes) or
    submitting from separate branches (for independent changes).

    The outstanding commits are:

    3daf4aa (HEAD -> master) Prepare file3
    00c4bab Add & fill file2
    3e4599e Fill file1
    525e68b Fill file0
    230ad8a Add file1

    Do you really want to submit the above commits?
    Type 'yes' to confirm, other to cancel: yes
    ```

9. 새로 업데이트한 수정 사항(`Patchset`)의 추가 리뷰가 완료된 두 커밋은 아래와 같은 상태가 됩니다. 커밋 ID는 변경되지만, `Change-Id`는 유지됩니다.

    * 커밋 `1c6798320543bf10066631ccd577e08e4e636c23` → `525e68be8aa1c4aff3b0ba0f24561259e9fd8d06`

        ![Gerrit 수정/리뷰 완료 1](/images/blog/git-gerrit-review-demo/gerrit-review-04.png)

        * `Gerrit`은 커밋이 수정될 때마다 `Patchset`이란 단위를 통해 변경 사항을 업데이트/관리합니다. `GitHub`이 보통 기존 커밋 자체는 그대로 두고 다른 커밋을 쌓아올리는 방식이라면, `Gerrit`은 커밋 내부적으로 변경 내역을 관리하는 방식입니다.
        * 아래와 같은 화면을 통해 `Patchset` `1`/`2`를 비교해 볼 수 있습니다. 여러 `Patchset` 사이를 옮겨다니면서 다양한 시점에서 변경 사항을 확인해 볼 수 있어 편리합니다. (예: `Patchset`: `base` to `end`, `3` to `4` 등)

            ![Gerrit 수정/리뷰 완료 1](/images/blog/git-gerrit-review-demo/gerrit-review-04_01.png)

    * 커밋 `b2cdd39e6c800f7db50c5c76c7f0fe689ec732bb` → `00c4bab0b8fa904ad015c956b487be42eb0eac82`

        ![Gerrit 수정/리뷰 완료 2](/images/blog/git-gerrit-review-demo/gerrit-review-05.png)

10. `Gerrit`에 함께 제출했던 마지막 커밋(CL)을 확인해보면 우측 상단에 `SUBMIT INCLUDING PARENTS` 버튼이 활성화된 것을 볼 수 있습니다. 이를 사용해 지금까지 작업한 내용을 한 번에 모두 반영합니다.

    ![Gerrit submit](/images/blog/git-gerrit-review-demo/gerrit-review-06.png)

11. 커밋들이 전부 머지되고 작업이 완료된 상태입니다.

    ![Gerrit merged](/images/blog/git-gerrit-review-demo/gerrit-review-07.png)

`Gerrit`에서의 작업 방식을 소개하는 것이 목표였던 만큼, `GitHub` 보다는 조금 더 자세히 설명해 보았습니다.

## Gerrit vs. GitHub

`Gerrit`과 `GitHub` 각각의 도구를 사용하는 경우를 비교해보면, 비슷한 듯 하면서도 차이점이 있습니다.
특히 직접 사용해보면서 체감하는 차이는 꽤 커서, 새로운 도구에 익숙해지는데 생각보다는 많은 시간이 필요합니다.

`GitHub`의 경우는, 잘 디자인 된 GUI 도구를 사용할 수 있고, 이와 잘 어우러지는 `PR`이라는 추가적인 개념을 통해 코드 수정 과정을 좀 더 친근?하게 관리할 수 있습니다.
(여기서 소개하진 않았지만) [`Fork`](https://docs.github.com/ko/get-started/quickstart/fork-a-repo)를 통한 Repository 간의 작업 공유도 수월합니다.

커밋 단위의 기존 작업 자체를 수정하기 보다는 추가적인 커밋으로 수정 작업을 진행하게 되는 경향이 있고, 이렇게 계속 추가되는 커밋을 통해 변경 내역을 Linear하게 파악하기 좋은 부분이 있습니다.
그러나 계속 덧붙여지는 커밋과 `PR`로 인해 보기에 따라서는 너무 장황해지는 부분이 존재하고, 호불호가 갈리기도 합니다.(이런 특성은 `PR`의 머지 정책 등을 변경하여 어느 정도 조절이 가능하지만, 코드를 수정하는 과정 자체는 거의 동일하며, Trade-off가 생깁니다.)
그리고 효과적인 사용을 위해서는 (`Git`이 아닌) `GitHub` 자체의 기능을 많이 배워야 하는 부분이 있습니다.

`Gerrit`은, `Git`을 보조해주는 도구로서의 성격이 보다 강합니다. 리뷰를 위해 공유되는 내용의 형식이나 분량이 조금 더 간결하고 가벼운 편으로, 커밋을 기반으로 약간의 정보가 더해지는 방식입니다.
수정 작업도 기존에 작업한 커밋 자체에 대해 이루어지고, `Git`의 기본 동작(`add`-`commit`-`push`)을 통한 코드 관리 루틴에서 크게 벗어나지 않습니다.
`Git`에 이미 익숙하여 이를 잘 이해하고 활용할 줄 아는 사람이라면 보다 직관적으로 사용하기 편리하게 만들어졌다고 할 수 있겠습니다.
로컬 환경에 작업한 내용 자체가 완결성을 가지고 리모트에도 동일하게 반영되며, 작업이 완료된 결과도 (`GitHub`에 비해) 대개 간단한 형태로 유지됩니다.

그러나 한편으로는 조금 불편하고 불친절하다고 볼 수도 있습니다. GUI는 딱 기본적인 부분만 갖추고 있으며, Web 환경에서의 코드 네비게이션, 비교 등은 기본적으로 불가능합니다.
기존 커밋을 하나하나 수정하여 새로운 `Patchset`을 올리는 과정은, `PR`에 새 커밋을 쌓아올리는 단순한 과정에 비교하면 조금 피곤할 때도 있습니다.

<script>(function(i,s,o,g,r,a,m){i['QP']=r;i[r]=i[r]||function(){(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)})(window,document,'script','//scripts.poll-maker.com/3012/pollembed.js','qp');</script><a href='https://take.supersurvey.com/poll4916491x558343d6-152' data-poll='4916491x558343d6-152' target="_blank" style='width:300px; display:block;'>GitHub vs. Gerrit 어떤 방식을 선호하시나요?</a>

## 마무리

개발 과정에서 `Git`과 `Gerrit`을 사용하여 협업을 진행할 때 가장 흔하게 발생하는 상황에 대해 시뮬레이션을 해 보고, 어떤 과정을 통해 작업이 이루어지는지 Step-by-step으로 살펴보았습니다.

물론 도구를 사용하는 방식에 정답은 없고, 각 상황이나 조직에 맞게 다양한 방법과 자체적인 규칙를 정하여 사용하는 것이 가장 효과적일 것입니다. 여기서는 가장 기본적인 방식 중 하나를 소개하는데 의의를 두었습니다.

[Gerrit을 사용할 때 도움이 되는 좋은 자료들](https://www.gerritcodereview.com/presentations.html)이 공식 홈페이지에 잘 정리되어 있는데, 이를 소개하면서 글을 마치겠습니다.
