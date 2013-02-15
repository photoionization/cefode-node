#include <node_vars.h>

#if defined(_WIN32)
#include <windows.h>
#else
#include <pthread.h>
#endif

namespace node {

#if defined(_WIN32)
static unsigned long loop_key;
#else
static pthread_key_t loop_key;
#endif
static uv_once_t tls_once_guard = UV_ONCE_INIT;

static void init_tls() {
#if defined(_WIN32)
  loop_key = TlsAlloc();
#else
  pthread_key_create(&loop_key, NULL);
#endif
}

globals* globals_get() {
  uv_once(&tls_once_guard, init_tls);

#if defined(_WIN32)
  void* data = TlsGetValue(loop_key);
#else
  void* data = pthread_getspecific(loop_key);
#endif
  if (data == NULL) {
    data = new globals();
#if defined(_WIN32)
    TlsSetValue(loop_key, data);
#else
    pthread_setspecific(loop_key, data);
#endif
  }

  return static_cast<globals*>(data);
}

void globals_free() {
  delete globals_get();
#if defined(_WIN32)
  TlsSetValue(loop_key, NULL);
#else
  pthread_setspecific(loop_key, NULL);
#endif
}

}  // namespace node
