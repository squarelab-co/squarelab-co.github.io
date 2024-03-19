---
layout: post
title: 죽임 당한 컨테이너 (exit status 143)
date: 2024-03-19T10:00:00+09:00
author: 이성빈
categories:
  - Engineering
og-img: https://squarelab.co/images/blog/argo-exit-status-143/cover.jpg
img: /images/blog/argo-exit-status-143/cover.jpg
img-author: /images/blog/author/seongbin.png
---

최근에 특정 Argo container가 작업이 종료되었음에도, process가 정상적으로 종료되지 않아서 외부에서 강제로 종료하다보니 `exit status 143` 에러가 발생하는 일이 있었습니다.
![Argo DAG](/images/blog/argo-exit-status-143/dag.png)
해당 Job을 Retry하면 주로 문제는 해결되었기에 대수롭지 않게 여기고 있었지만, 하루에 한번 정도 빈도로 해당 문제가 꼭 발생하다보니, 귀차니즘이 발동하여 왜 발생하는지 그 원인을 찾아보게 되었습니다.

일정한 주기마다, 혹은 원하는 시점에 미리 정의해놓은 작업을 자동으로 수행하기 위해, [Argo](https://argoproj.github.io/)를 사용하는 것은 좋은 선택입니다. Argo workflows와 관련해서는 [영재님께서 작성해주신 글](https://squarelab.co/blog/how-to-build-flight-fare-data-pipeline-with-argo/)을 참고해주세요.

## exit status 143 의 의미

`exit status 143` 은 유닉스 및 유닉스 계열 시스템에서 프로세스가 외부 신호에 의해 종료되었다는 의미 입니다. 유닉스 시스템에서는 외부 신호에 의한 종료 상태 코드를 구별하기 위해 기본 신호 값에 `128` 을 더합니다. 이는 프로그램이 자체적으로 정의한 종료 코드와 시스템이 발생시킨 종료 코드를 구별하는 데 도움이 됩니다.
즉, `SIGTERM(15)` 에 `128`을 더해서 `143` 이라는 값이 나왔고, 이는 프로세스가 `SIGTERM` 신호에 의해 종료되었음을 의미합니다. 조금 더 자세한 이해는 아래 글을 참고해주시면 도움이 될 것 같습니다.

- [SIGTERM과 SIGKILL의 차이](https://code-lab1.tistory.com/318)
- [Trouble Shooting Guide for exit status 143](https://www.groundcover.com/kubernetes-troubleshooting/exit-code-143)

주로 문제가 되던 Workflow Job은 푸시를 발송하거나, 발송한 푸시에 대한 정보들을 수집하기 위해 Braze API와 통신하고 있다는 공통점이 있었습니다. 저희가 푸시를 어떻게 발송하고 있는지는 [조이님께서 작성해주신 시스템푸시 개발기](https://squarelab.co/blog/system-push/)를 참고해주세요.

## Job의 구조

Kotlin + Dagger를 사용하는 Job은 다음과 같은 구조로 작성되었습니다.

- `provideBrazeApi`함수는 다음과 같이 `BrazeApi` interface를 return 하고, 이 때 `retrofit` 이 사용됩니다.

```kotlin
// NetworkModule.kt
@Module
class NetworkModule {
	@Provides
	@Singleton
	fun provideBrazeApi(
	    @Named("snakeCase") objectMapper: ObjectMapper,
	): BrazeApi {
	  // OkHttpClientBuilder 는 OkHttpClient.Builder()를 생성하는 커스텀 빌더입니다.
	  val httpClient = OkHttpClientBuilder.newBuilder(
	      poolSize = poolSize,
	      maxRequestsPerHost = maxRequestsPerHost,
	      maxRequests = maxRequests,
	      headers = listOf(
	          "Content-Type" to "application/json",
	          "Authorization" to "Bearer ${config[Config.Braze.apiKey]}"
	      )
	  ).build()

	  val retrofit = Retrofit.Builder()
	      .client(httpClient)
	      .baseUrl(config[Config.Braze.baseUrl])
	      .addConverterFactory(JacksonConverterFactory.create(objectMapper))
	      .build()

	  return retrofit.create(BrazeApi::class.java)
	}
	...
}
```

- `brazeApi` 는 아래와 같이 Job 내에서 Inject 됩니다.

```kotlin
open class SomeJob: Job {
  @Inject
  lateinit var brazeApi: BrazeApi
  override fun execute(params: Map<String, String>) {
	  // do something with brazeApi
  }
}
```

- MainComponent를 아래와 같이 정의했다면,

```kotlin
// MainComponent.kt
@Singleton
@Component(
    modules = [
      NetworkModule::class,
      ...
    ]
)
interface MainComponent {
  fun someJob(): SomeJob
  ...
}
```

- `Main` 에서는 아래와 같은 흐름으로 CommandLine으로 전달받은 job을 찾아서 실행합니다.

```kotlin
// Main.kt
object Main {
	@JvmStatic
	fun main(args: Array<String>) {
		val options = generateCliOptions()
		val command: CommandLine
		// skip parsing command
		val jobName = command.getOptionValue("jobName")
		// skip getting job function by job Name
		logger.info("Starting jobName: $jobName")
		job.execute()
		logger.info("Finished jobName: $jobName")
	}
}
```

## Job의 이상 현상

정상적으로 특정 Job이 수행이 완료되었다는 로그가 출력되었는데, `SIGTERM` 신호를 받고 Argo Container가 에러를 뱉으며 죽어있는 상황이라니, 이해할 수 없는 상황이었습니다.

처음에는 해당 Job의 코드에 문제가 있는지 유심히 살펴봤습니다. 로직 상으로는 큰 문제가 없었기에, 에러가 발생할 것이라고 예상되던 부분은 외부 API와 통신하는 부분이었습니다. 그러나, 외부와 통신하면서 발생할 수 있는 부분에는 에러처리가 명확히 되어있었기 때문에, 문제는 더욱 미궁속으로 빠져들어갔습니다.

Argo workflows 로그에서 특이한 점을 발견했다면, `Finished job` 로그가 출력된 이후에, 1분 정도를 기다리다가 kill 되었다는 것입니다. 아래 로그에서 어떤 상황인지 살펴보실 수 있습니다.

```
# wait container
time="YYYY-MM-DDT07:20:47 UTC" level=info msg="Executor initialized" deadline="YYYY-MM-DD 07:22:01 +0000 UTC"
time="YYYY-MM-DDT07:20:47 UTC" level=info msg="Starting deadline monitor" time="YYYY-MM-DDT07:22:01 UTC" level=info msg="Step exceeded its deadline" time="YYYY-MM-DDT07:22:01 UTC" level=info msg="Killing containers"
time="YYYY-MM-DDT07:22:02 UTC" level=info msg="Main container completed" error="<nil>"

# main container
"message":"Starting jobName: SomeJob","@timestamp":"YYYY-MM-DDT07:20:54.694Z"
...
"message":"Finished jobName: SomeJob","@timestamp":"YYYY-MM-DDT07:21:16.180Z"
```

`main container`는 07:21:16에 작업이 완료되었기 때문에, 07:22:01 까지는 아무 작업도 없이 살아있다가, `wait container`에 의해 종료되었습니다. 이 사이에 무슨 일이 발생하고 있던 걸까요?

![log_diagram](/images/blog/argo-exit-status-143/log_diagram.png)

로컬에서 해당 현상을 재현하기는 어려웠지만, 해당 Job이 바로 종료되지 않고 1분 정도를 기다려야 종료된다는 공통점이 있었습니다. 이 부분에 문제의 원인이 있을 것이라는 강한 의심이 들었고, 무엇이 1분 동안 Job을 종료시키지 않고 있을까 찾아보기 시작했습니다.

## 무엇이 문제였을까?

Job이 마무리 되었지만, 어떤 커넥션이 살아있어서 main 프로세스가 종료되지 않고 있는지를 파악해보기 위해,
아무것도 수행하지 않는 빈 Job을 만들고, 그 안에 아래 역할을 하는 각종 서비스들을 Inject 시켜가면서 Job이 정상적으로 종료되는지 여부를 확인해봤습니다.

- 내부 microservices 들과의 통신
- 외부 서비스 API 들과의 통신
- MongoDB / Big Query / Elasticsearch / Redis / SlackBot / ...

그렇게 찾아낸 main container를 종료시키지 않던 범인은 바로 `okhttp3` 을 사용하는 httpClient였습니다.🕵️
`okhttp3` 내부 코드를 살펴보니, `keepAliveTime` 을 자체적으로 1분 값을 가지고 있었습니다.

[okhttp3 - Dispatcher.kt](https://github.com/square/okhttp/blob/639abfe4f24af5aa2db124a13c2e4e8f62d39cfc/okhttp/src/main/kotlin/okhttp3/Dispatcher.kt#L89-L107)

```kotlin
@get:Synchronized
  @get:JvmName("executorService")
  val executorService: ExecutorService
    get() {
      if (executorServiceOrNull == null) {
        executorServiceOrNull =
          ThreadPoolExecutor(
            0,
            Int.MAX_VALUE,
            60, // here
            TimeUnit.SECONDS,
            SynchronousQueue(),
            threadFactory("$okHttpName Dispatcher", false),
          )
      }
      return executorServiceOrNull!!
    }
```

[ThreadPoolExecutor](https://developer.android.com/reference/kotlin/java/util/concurrent/ThreadPoolExecutor#threadpoolexecutor_2)

```kotlin
ThreadPoolExecutor(corePoolSize: Int, maximumPoolSize: Int, keepAliveTime: Long, unit: TimeUnit!, workQueue: BlockingQueue<Runnable!>!, threadFactory: ThreadFactory!)
```

**즉, 아래와 같은 과정을 거치면서 에러가 발생했다고 볼 수 있습니다.**

1. `executorService` thread가 살아있어서 process가 종료되지 않음.
2. 해당 컨테이너가 argo workflows에서 설정한 `activeDeadlineSeconds` 을 초과해버림
3. wait container에서 main container로 `SIGTERM` 신호를 보냄
4. main container가 죽으면서 `exit status 143` 를 남김.

결과적으로 `okHttpClinet`의 `executorService`를 Job이 마무리된 시점에 종료시켜준다면, `exit status 143` 로 Job이 종료되는 현상을 막을 수 있을 것으로 예상할 수 있었습니다.

## okHttpClient를 직접 관리하기

`retrofit` 객체에 접근해서 명시적으로 `executorService`를 종료할 수 있으면 좋겠지만, `retrofit` object 에서는 httpClient에 접근할 수 없다는 문제가 있었습니다.

- [(Android) Retrofit2는어떻게 동작하는가](https://medium.com/jaesung-dev/android-retrofit2%EB%8A%94-%EC%96%B4%EB%96%BB%EA%B2%8C-%EB%8F%99%EC%9E%91%ED%95%98%EB%8A%94%EA%B0%80-3-okhttp3%EC%9D%98%EC%8A%A4%EB%A0%88%EB%93%9C-%EA%B4%80%EB%A6%AC-b90a36808d37)

그래서 `httpClient`들을 Job이 finish 된 시점에 shutdown 할 수 있도록 관리하는 별도의 `OkHttpClientManager` 를 작성하는 것이 좋아보였습니다.

```kotlin
import okhttp3.OkHttpClient

class OkHttpClientManager {
  private val clients = mutableListOf<OkHttpClient>()

  fun addClient(client: OkHttpClient) {
    clients.add(client)
  }

  fun shutdown() {
    clients.forEach {
      it.dispatcher.executorService.shutdown()
      it.connectionPool.evictAll()
    }
  }
}
```

`OkHttpClientManager` 을 Inject 받아서 사용할 수 있도록, `MainComponent` 에 추가하고,

```kotlin
// MainComponent.kt
...
interface MainComponent {
  fun okHttpClientManager(): OkHttpClientManager
  fun someJob(): SomeJob
  ...
}
```

`NetworkModule`에서는 `okHttpClientManager`를 Inject 받아서 사용했습니다.

```kotlin
// NetworkModule.kt
	...
	fun provideBrazeApi(
	    @Named("snakeCase") objectMapper: ObjectMapper,
	    okHttpClientManager: OkHttpClientManager
	): BrazeApi {
	  val httpClient = OkHttpClientBuilder.newBuilder(
	      ...
	  ).build()

	  okHttpClientManager.add(httpClient) // added

	  val retrofit = Retrofit.Builder()
	      ...
	      .build()

	  return retrofit.create(BrazeApi::class.java)
	}
	...
```

`Main` 에서는 Job이 수행이 완료되면 `okHttpClientManager().shutdown()`를 호출하여 `httpClient` 들의 `dispatcher.executorService` thread를 명시적으로 종료해주었습니다.

```kotlin
// Main.kt
object Main {
	@JvmStatic
	fun main(args: Array<String>) {
		val component = DaggerMainComponent.builder().build()
		...
		component.okHttpClientManager().shutdown()
	}
}
```

## 마무리

![dag_success](/images/blog/argo-exit-status-143/dag_success.png)
이상 현상이 발생했을 때는 로그를 꼼꼼히 살펴보는 것이 중요한 것 같습니다. 이상 현상이 발생할 수 있는 부분을 찾은 이후에는, 근본적인 문제를 해결하기 위해 유지보수가 유용하도록 코드를 수정할 수 있어야하겠습니다. 명시적으로 `executorService` 를 종료하는 방식을 통해서, 불필요하게 사용되고 있던 서버 자원을 절약할 수 있었습니다. DI 패턴에 맞게 코드를 작성하는데 도움 주신 영재님께 감사드립니다. 🙇‍♂️

다만, 이것이 근본적인 문제를 해결한 것은 아니었습니다.[`activeDeadlineSeconds`]([Argo Workflows - Timeouts](https://argo-workflows.readthedocs.io/en/latest/walk-through/timeouts/)) 가 충분하게 설정되어있었으나, 재시도 될 때에는 2분 정도로 짧게 유지되는 것이 `exit status 143` 의 근본적인 원인이었습니다.

이 문제는 어떻게 해결했을까요? 다음 글을 기대해주세요 🙏
