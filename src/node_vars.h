#ifndef NODE_VARS_H
#define NODE_VARS_H

// This file contains all Isolate-local variables. We allow people to
// compile Node either with Isolates or without. In the case that they
// compile without isolates, these will be static variables.

#include <v8.h>
#include <uv.h>
#include <http_parser.h>

namespace node {

#define NODE_VAR(x) (globals_get()->x)

struct globals {
  // node.cc
  v8::Persistent<v8::String> errno_symbol;
  v8::Persistent<v8::String> syscall_symbol;
  v8::Persistent<v8::String> errpath_symbol;
  v8::Persistent<v8::String> code_symbol;

  v8::Persistent<v8::String> rss_symbol;
  v8::Persistent<v8::String> heap_total_symbol;
  v8::Persistent<v8::String> heap_used_symbol;

  v8::Persistent<v8::String> listeners_symbol;
  v8::Persistent<v8::String> uncaught_exception_symbol;
  v8::Persistent<v8::String> emit_symbol;

  v8::Persistent<v8::String> enter_symbol;
  v8::Persistent<v8::String> exit_symbol;
  v8::Persistent<v8::String> disposed_symbol;

  // cares_wrap.cc
  v8::Persistent<v8::String> oncomplete_sym;

  ::ares_channel ares_channel;

  // fs_event_wrap.cc
  v8::Persistent<v8::String> onchange_sym;

  // node_buffer.cc
  v8::Persistent<v8::String> length_symbol;
  v8::Persistent<v8::String> chars_written_sym;
  v8::Persistent<v8::String> write_sym;
  v8::Persistent<v8::FunctionTemplate> buffer_constructor_template;

  // node_crypto.cc
  v8::Persistent<v8::String> subject_symbol;
  v8::Persistent<v8::String> subjectaltname_symbol;
  v8::Persistent<v8::String> modulus_symbol;
  v8::Persistent<v8::String> exponent_symbol;
  v8::Persistent<v8::String> issuer_symbol;
  v8::Persistent<v8::String> valid_from_symbol;
  v8::Persistent<v8::String> valid_to_symbol;
  v8::Persistent<v8::String> fingerprint_symbol;
  v8::Persistent<v8::String> name_symbol;
  v8::Persistent<v8::String> version_symbol;
  v8::Persistent<v8::String> ext_key_usage_symbol;
  v8::Persistent<v8::String> onhandshakestart_sym;
  v8::Persistent<v8::String> onhandshakedone_sym;

  v8::Persistent<v8::FunctionTemplate> secure_context_constructor;

  // node_file.cc
  v8::Persistent<v8::String> encoding_symbol;
  v8::Persistent<v8::String> buf_symbol;

  v8::Persistent<v8::FunctionTemplate> stats_constructor_template;

  v8::Persistent<v8::String> dev_symbol;
  v8::Persistent<v8::String> ino_symbol;
  v8::Persistent<v8::String> mode_symbol;
  v8::Persistent<v8::String> nlink_symbol;
  v8::Persistent<v8::String> uid_symbol;
  v8::Persistent<v8::String> gid_symbol;
  v8::Persistent<v8::String> rdev_symbol;
  v8::Persistent<v8::String> size_symbol;
  v8::Persistent<v8::String> blksize_symbol;
  v8::Persistent<v8::String> blocks_symbol;
  v8::Persistent<v8::String> atime_symbol;
  v8::Persistent<v8::String> mtime_symbol;
  v8::Persistent<v8::String> ctime_symbol;

  // node_http_parser.cc
  v8::Persistent<v8::String> on_headers_sym;
  v8::Persistent<v8::String> on_headers_complete_sym;
  v8::Persistent<v8::String> on_body_sym;
  v8::Persistent<v8::String> on_message_complete_sym;

  v8::Persistent<v8::String> method_sym;
  v8::Persistent<v8::String> status_code_sym;
  v8::Persistent<v8::String> http_version_sym;
  v8::Persistent<v8::String> version_major_sym;
  v8::Persistent<v8::String> version_minor_sym;
  v8::Persistent<v8::String> should_keep_alive_sym;
  v8::Persistent<v8::String> upgrade_sym;
  v8::Persistent<v8::String> headers_sym;
  v8::Persistent<v8::String> url_sym;

  v8::Persistent<v8::String> unknown_method_sym;

  struct http_parser_settings settings;

  v8::Local<v8::Value>* current_buffer;
  char* current_buffer_data;
  size_t current_buffer_len;

  // node_io_watcher.cc
  v8::Persistent<v8::FunctionTemplate> io_watcher_constructor_template;
  v8::Persistent<v8::String> callback_symbol;
};

// Get globals for current thread.
globals* globals_get();

// Free after the thread ends.
void globals_free();

}  // namespace node
#endif  // NODE_VARS_H
