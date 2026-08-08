package service

import (
	"time"

	"github.com/Wei-Shaw/sub2api/internal/pkg/timezone"
)

const (
	subscriptionDayDuration      = 24 * time.Hour
	subscriptionFiveHourDuration = 5 * time.Hour
)

type UserSubscription struct {
	ID       int64
	UserID   int64
	PlanID   int64
	PlanName string

	StartsAt  time.Time
	ExpiresAt time.Time
	Status    string

	DailyWindowStart   *time.Time
	WeeklyWindowStart  *time.Time
	MonthlyWindowStart *time.Time

	DailyUsageUSD   float64
	WeeklyUsageUSD  float64
	MonthlyUsageUSD float64

	FiveHourQuotaUSD      *float64
	FiveHourStartedAt     *time.Time
	FiveHourUsageUSD      float64
	FiveHourReservedUSD   float64
	CycleQuotaUSD         *float64
	ResetIntervalSeconds  int
	CycleStartedAt        *time.Time
	CycleUsageUSD         float64
	CycleReservedUSD      float64
	TotalQuotaUSD         *float64
	TotalUsageUSD         float64
	TotalReservedUSD      float64
	WalletFallbackEnabled bool

	AssignedBy *int64
	AssignedAt time.Time
	Notes      string

	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt *time.Time

	User           *User
	AssignedByUser *User
	IncludedGroups []Group
}

func (s *UserSubscription) CoversGroup(groupID int64) bool {
	if s == nil || groupID <= 0 {
		return false
	}
	for i := range s.IncludedGroups {
		if s.IncludedGroups[i].ID == groupID {
			return true
		}
	}
	return false
}

func (s *UserSubscription) HasCycleQuota() bool {
	return s != nil && s.CycleQuotaUSD != nil && *s.CycleQuotaUSD > 0
}

func (s *UserSubscription) HasFiveHourQuota() bool {
	return s != nil && s.FiveHourQuotaUSD != nil && *s.FiveHourQuotaUSD > 0
}

func (s *UserSubscription) FiveHourResetTimeAt(now time.Time) *time.Time {
	if s == nil || s.FiveHourStartedAt == nil {
		return nil
	}
	start := *s.FiveHourStartedAt
	if !now.Before(start.Add(subscriptionFiveHourDuration)) {
		periods := now.Sub(start) / subscriptionFiveHourDuration
		start = start.Add(periods * subscriptionFiveHourDuration)
	}
	reset := start.Add(subscriptionFiveHourDuration)
	if reset.After(s.ExpiresAt) {
		reset = s.ExpiresAt
	}
	return &reset
}

func (s *UserSubscription) FiveHourUsageAt(now time.Time) float64 {
	if s == nil || s.FiveHourStartedAt == nil {
		return s.FiveHourUsageUSD
	}
	if !now.Before(s.FiveHourStartedAt.Add(subscriptionFiveHourDuration)) {
		return 0
	}
	return s.FiveHourUsageUSD
}

func (s *UserSubscription) CheckFiveHourLimitAt(now time.Time, additionalCost float64) bool {
	if !s.HasFiveHourQuota() {
		return true
	}
	reserved := s.FiveHourReservedUSD
	if reserved < 0 {
		reserved = 0
	}
	committed := s.FiveHourUsageAt(now) + reserved
	if additionalCost <= 0 {
		return committed < *s.FiveHourQuotaUSD
	}
	return committed+additionalCost <= *s.FiveHourQuotaUSD
}

func (s *UserSubscription) HasTotalQuota() bool {
	return s != nil && s.TotalQuotaUSD != nil && *s.TotalQuotaUSD > 0
}

func (s *UserSubscription) CycleResetTimeAt(now time.Time) *time.Time {
	if s == nil || s.CycleStartedAt == nil || s.ResetIntervalSeconds <= 0 {
		return nil
	}
	period := time.Duration(s.ResetIntervalSeconds) * time.Second
	start := *s.CycleStartedAt
	if !now.Before(start.Add(period)) {
		periods := now.Sub(start) / period
		start = start.Add(periods * period)
	}
	reset := start.Add(period)
	if reset.After(s.ExpiresAt) {
		reset = s.ExpiresAt
	}
	return &reset
}

func (s *UserSubscription) CycleUsageAt(now time.Time) float64 {
	if s == nil || s.CycleStartedAt == nil || s.ResetIntervalSeconds <= 0 {
		return s.CycleUsageUSD
	}
	if !now.Before(s.CycleStartedAt.Add(time.Duration(s.ResetIntervalSeconds) * time.Second)) {
		return 0
	}
	return s.CycleUsageUSD
}

func (s *UserSubscription) CheckCycleLimitAt(now time.Time, additionalCost float64) bool {
	if !s.HasCycleQuota() {
		return true
	}
	reserved := s.CycleReservedUSD
	if reserved < 0 {
		reserved = 0
	}
	committed := s.CycleUsageAt(now) + reserved
	if additionalCost <= 0 {
		return committed < *s.CycleQuotaUSD
	}
	return committed+additionalCost <= *s.CycleQuotaUSD
}

func (s *UserSubscription) CheckTotalLimit(additionalCost float64) bool {
	if !s.HasTotalQuota() {
		return true
	}
	reserved := s.TotalReservedUSD
	if reserved < 0 {
		reserved = 0
	}
	committed := s.TotalUsageUSD + reserved
	if additionalCost <= 0 {
		return committed < *s.TotalQuotaUSD
	}
	return committed+additionalCost <= *s.TotalQuotaUSD
}

func (s *UserSubscription) CheckQuotaLimitsAt(now time.Time, additionalCost float64) bool {
	return s.CheckFiveHourLimitAt(now, additionalCost) &&
		s.CheckCycleLimitAt(now, additionalCost) &&
		s.CheckTotalLimit(additionalCost)
}

func (s *UserSubscription) IsActive() bool {
	return s.Status == SubscriptionStatusActive && time.Now().Before(s.ExpiresAt)
}

func (s *UserSubscription) IsExpired() bool {
	return time.Now().After(s.ExpiresAt)
}

func (s *UserSubscription) DaysRemaining() int {
	return s.daysRemainingAt(time.Now())
}

func (s *UserSubscription) daysRemainingAt(now time.Time) int {
	remaining := s.ExpiresAt.Sub(now)
	if remaining <= 0 {
		return 0
	}

	days := int(remaining / subscriptionDayDuration)
	if remaining%subscriptionDayDuration != 0 {
		days++
	}
	return days
}

func (s *UserSubscription) IsWindowActivated() bool {
	return s.DailyWindowStart != nil || s.WeeklyWindowStart != nil || s.MonthlyWindowStart != nil
}

func (s *UserSubscription) HasOneTimeDailyQuota() bool {
	if s == nil || s.StartsAt.IsZero() || s.ExpiresAt.IsZero() {
		return false
	}
	return !s.ExpiresAt.After(s.StartsAt.AddDate(0, 0, 1))
}

func (s *UserSubscription) NeedsDailyReset() bool {
	return s.NeedsDailyResetAt(time.Now())
}

func (s *UserSubscription) NeedsDailyResetAt(now time.Time) bool {
	_, ok := s.automaticDailyWindowStartAt(now)
	return ok
}

func (s *UserSubscription) NeedsWeeklyReset() bool {
	return s.NeedsWeeklyResetAt(time.Now())
}

func (s *UserSubscription) NeedsWeeklyResetAt(now time.Time) bool {
	if s.WeeklyWindowStart == nil {
		return false
	}
	return !now.Before(s.WeeklyWindowStart.Add(7 * 24 * time.Hour))
}

func (s *UserSubscription) NeedsMonthlyReset() bool {
	return s.NeedsMonthlyResetAt(time.Now())
}

func (s *UserSubscription) NeedsMonthlyResetAt(now time.Time) bool {
	if s.MonthlyWindowStart == nil {
		return false
	}
	return !now.Before(s.MonthlyWindowStart.Add(30 * 24 * time.Hour))
}

func (s *UserSubscription) canAutomaticallyResetDailyAt(now time.Time) bool {
	_, ok := s.automaticDailyWindowStartAt(now)
	return ok
}

// automaticDailyWindowStartAt 计算日窗口按“配置时区日历日”对齐后的当前窗口起点。
// 日额度固定在每天 0 点刷新（与周/月的期限对齐滚动窗口语义不同），因此只要持久化
// 的窗口起点落在更早的日历日，就允许推进到今天 0 点。手动重置、激活等写入的任何
// 非 0 点锚点都会在下一个 0 点被拉回日历日边界，不会永久漂移刷新时刻。
func (s *UserSubscription) automaticDailyWindowStartAt(now time.Time) (time.Time, bool) {
	if s.DailyWindowStart == nil {
		return time.Time{}, false
	}
	if s.HasOneTimeDailyQuota() {
		return time.Time{}, false
	}
	today := timezone.StartOfDay(now)
	if !today.After(timezone.StartOfDay(*s.DailyWindowStart)) {
		return time.Time{}, false
	}
	return today, true
}

func (s *UserSubscription) canAutomaticallyResetWeeklyAt(now time.Time) bool {
	_, ok := s.automaticWindowStartAt(s.WeeklyWindowStart, 7*24*time.Hour, now)
	return ok
}

func (s *UserSubscription) canAutomaticallyResetMonthlyAt(now time.Time) bool {
	_, ok := s.automaticWindowStartAt(s.MonthlyWindowStart, 30*24*time.Hour, now)
	return ok
}

// automaticWindowStartAt 计算周/月窗口（期限对齐滚动窗口）的当前窗口起点。
// 窗口从锚点按整数个 period 步进，且不越过订阅到期时间，避免最后一个不完整
// 周期重复发放额度（issue #5051）。日窗口不走此函数，见 automaticDailyWindowStartAt。
func (s *UserSubscription) automaticWindowStartAt(previous *time.Time, period time.Duration, now time.Time) (time.Time, bool) {
	if previous == nil {
		return time.Time{}, false
	}

	anchor := *previous
	// Older subscriptions initialized their first windows at midnight on their
	// start date. Only that initial value is unambiguous; later midnight anchors
	// may be manual resets and must remain authoritative.
	legacyAnchor := startOfDay(s.StartsAt)
	if legacyAnchor.Before(s.StartsAt) && anchor.Equal(legacyAnchor) {
		anchor = s.StartsAt
	}
	next := anchor.Add(period)
	if now.Before(next) || !next.Before(s.ExpiresAt) {
		return time.Time{}, false
	}

	periods := now.Sub(anchor) / period
	lastPeriodBeforeExpiry := (s.ExpiresAt.Sub(anchor) - 1) / period
	if periods > lastPeriodBeforeExpiry {
		periods = lastPeriodBeforeExpiry
	}
	return anchor.Add(periods * period), true
}

func (s *UserSubscription) DailyResetTime() *time.Time {
	if s.DailyWindowStart == nil {
		return nil
	}
	if s.HasOneTimeDailyQuota() {
		t := s.ExpiresAt
		return &t
	}
	// 日窗口按日历日对齐：下次刷新固定在窗口起点所在日的次日 0 点。
	t := timezone.StartOfDay(*s.DailyWindowStart).AddDate(0, 0, 1)
	return &t
}

func (s *UserSubscription) WeeklyResetTime() *time.Time {
	if s.WeeklyWindowStart == nil {
		return nil
	}
	t := s.WeeklyWindowStart.Add(7 * 24 * time.Hour)
	return &t
}

func (s *UserSubscription) MonthlyResetTime() *time.Time {
	if s.MonthlyWindowStart == nil {
		return nil
	}
	t := s.MonthlyWindowStart.Add(30 * 24 * time.Hour)
	return &t
}

func (s *UserSubscription) CheckDailyLimit(group *Group, additionalCost float64) bool {
	if !group.HasDailyLimit() {
		return true
	}
	return s.DailyUsageUSD+additionalCost <= *group.DailyLimitUSD
}

func (s *UserSubscription) CheckWeeklyLimit(group *Group, additionalCost float64) bool {
	if !group.HasWeeklyLimit() {
		return true
	}
	return s.WeeklyUsageUSD+additionalCost <= *group.WeeklyLimitUSD
}

func (s *UserSubscription) CheckMonthlyLimit(group *Group, additionalCost float64) bool {
	if !group.HasMonthlyLimit() {
		return true
	}
	return s.MonthlyUsageUSD+additionalCost <= *group.MonthlyLimitUSD
}

func (s *UserSubscription) CheckAllLimits(group *Group, additionalCost float64) (daily, weekly, monthly bool) {
	daily = s.CheckDailyLimit(group, additionalCost)
	weekly = s.CheckWeeklyLimit(group, additionalCost)
	monthly = s.CheckMonthlyLimit(group, additionalCost)
	return
}
