package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestDingTalkClient_ExchangeCodeForUserToken_Success(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "POST", r.Method)
		require.Equal(t, "/v1.0/oauth2/userAccessToken", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"accessToken":"USER_TOKEN_X","expireIn":7200,"refreshToken":"R","corpId":"dingABC"}`))
	})

	cli := &DingTalkClient{
		cfg: dingTalkClientConfig{
			ClientID: "k", ClientSecret: "s",
			TokenURL: "https://dingtalk.test/v1.0/oauth2/userAccessToken",
		},
		httpClient: newDingTalkFixtureHTTPClient(handler),
	}
	resp, err := cli.ExchangeCodeForUserToken(context.Background(), "AUTH_CODE")
	require.NoError(t, err)
	require.Equal(t, "USER_TOKEN_X", resp.AccessToken)
	require.Equal(t, "dingABC", resp.CorpID)
}

func TestDingTalkClient_GetUnionIdByUserToken_Success(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "USER_TOKEN_X", r.Header.Get("x-acs-dingtalk-access-token"))
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"nick":"张三","unionId":"UID_AAA","openId":"OPEN","avatarUrl":"http://x"}`))
	})

	cli := &DingTalkClient{
		cfg:        dingTalkClientConfig{UserInfoURL: "https://dingtalk.test/v1.0/contact/users/me"},
		httpClient: newDingTalkFixtureHTTPClient(handler),
	}
	unionID, nick, err := cli.GetUnionIdByUserToken(context.Background(), "USER_TOKEN_X")
	require.NoError(t, err)
	require.Equal(t, "UID_AAA", unionID)
	require.Equal(t, "张三", nick)
}

func TestDingTalkClient_GetAppToken_Cached(t *testing.T) {
	callCount := 0
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		_, _ = w.Write([]byte(`{"accessToken":"APP_TKN","expireIn":7200}`))
	})

	cli := &DingTalkClient{
		cfg:        dingTalkClientConfig{ClientID: "k", ClientSecret: "s", TokenURL: "https://dingtalk.test/gettoken"},
		httpClient: newDingTalkFixtureHTTPClient(handler),
	}
	t1, err := cli.GetAppToken(context.Background())
	require.NoError(t, err)
	t2, err := cli.GetAppToken(context.Background())
	require.NoError(t, err)
	require.Equal(t, t1, t2)
	require.Equal(t, 1, callCount, "second call should hit cache")
}

func TestDingTalkClient_GetUserIdByUnionId_60011(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"errcode":60011,"errmsg":"not in directory"}`))
	})

	cli := &DingTalkClient{
		cfg:        dingTalkClientConfig{TokenURL: "https://dingtalk.test/gettoken"},
		httpClient: newDingTalkFixtureHTTPClient(handler),
	}
	cli.appToken = "APP_TKN"
	cli.appTokenExp = time.Now().Add(time.Hour)
	cli.cfg.UserInfoURL = "https://dingtalk.test/v1.0/contact/users/byUnionId"

	_, err := cli.GetUserIdByUnionId(context.Background(), "UID_AAA")
	require.Error(t, err)
	apiErr, ok := err.(*DingTalkAPIError)
	require.True(t, ok)
	require.Equal(t, "60011", apiErr.Code)
}

// TestDingTalkClient_GetDeptInfo_Success 验证 GetDeptInfo 正常情况返回部门信息。
func TestDingTalkClient_GetDeptInfo_Success(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"errcode":0,"errmsg":"ok","result":{"dept_id":42,"name":"AI数据","parent_id":1}}`))
	})

	cli := &DingTalkClient{
		cfg: dingTalkClientConfig{
			UserInfoURL: "https://dingtalk.test/stub", // 不含 /contact/users/me，走 test stub 路径
		},
		httpClient: newDingTalkFixtureHTTPClient(handler),
	}
	cli.appToken = "APP_TKN"
	cli.appTokenExp = time.Now().Add(time.Hour)

	info, err := cli.GetDeptInfo(context.Background(), 42)
	require.NoError(t, err)
	require.Equal(t, int64(42), info.DeptID)
	require.Equal(t, "AI数据", info.Name)
	require.Equal(t, int64(1), info.ParentID)
}

// TestDingTalkClient_GetDeptInfo_ErrCode60003 验证 errcode=60003（部门不存在）时返回错误。
func TestDingTalkClient_GetDeptInfo_ErrCode60003(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"errcode":60003,"errmsg":"dept not found"}`))
	})

	cli := &DingTalkClient{
		cfg:        dingTalkClientConfig{UserInfoURL: "https://dingtalk.test/stub"},
		httpClient: newDingTalkFixtureHTTPClient(handler),
	}
	cli.appToken = "APP_TKN"
	cli.appTokenExp = time.Now().Add(time.Hour)

	_, err := cli.GetDeptInfo(context.Background(), 999)
	require.Error(t, err)
	apiErr, ok := err.(*DingTalkAPIError)
	require.True(t, ok)
	require.Equal(t, "60003", apiErr.Code)
}

func newDingTalkFixtureHTTPClient(handler http.Handler) *http.Client {
	return &http.Client{Transport: dingtalkFixtureRoundTripper(func(req *http.Request) (*http.Response, error) {
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, req)
		return recorder.Result(), nil
	})}
}

type dingtalkFixtureRoundTripper func(*http.Request) (*http.Response, error)

func (f dingtalkFixtureRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}
