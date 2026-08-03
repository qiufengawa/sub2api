package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// SubscriptionPlan holds the schema definition for the SubscriptionPlan entity.
//
// 删除策略：硬删除
// SubscriptionPlan 使用硬删除而非软删除，原因如下：
//   - 套餐为管理员维护的商品配置，删除即表示下架移除
//   - 通过 for_sale 字段控制是否在售，删除仅用于彻底移除
//   - 已产生订阅记录的套餐只能下架，服务层会阻止硬删除以保留历史关联
type SubscriptionPlan struct {
	ent.Schema
}

func (SubscriptionPlan) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "subscription_plans"},
	}
}

func (SubscriptionPlan) Fields() []ent.Field {
	return []ent.Field{
		field.String("name").
			MaxLen(100).
			NotEmpty(),
		field.String("description").
			SchemaType(map[string]string{dialect.Postgres: "text"}).
			Default(""),
		field.Float("price").
			SchemaType(map[string]string{dialect.Postgres: "decimal(20,2)"}),
		field.Float("original_price").
			SchemaType(map[string]string{dialect.Postgres: "decimal(20,2)"}).
			Optional().
			Nillable(),
		field.String("currency").
			MaxLen(3).
			Default(""),
		field.Float("cycle_quota_usd").
			SchemaType(map[string]string{dialect.Postgres: "decimal(20,10)"}).
			Optional().
			Nillable(),
		field.Float("total_quota_usd").
			SchemaType(map[string]string{dialect.Postgres: "decimal(20,10)"}).
			Optional().
			Nillable(),
		field.Int("reset_interval_seconds").
			Default(0),
		field.Bool("wallet_fallback_enabled").
			Default(true),
		field.Int("validity_days").
			Default(30),
		field.String("validity_unit").
			MaxLen(10).
			Default("day"),
		field.String("features").
			SchemaType(map[string]string{dialect.Postgres: "text"}).
			Default(""),
		field.String("product_name").
			MaxLen(100).
			Default(""),
		field.Bool("for_sale").
			Default(true),
		field.Int("sort_order").
			Default(0),
		field.Time("created_at").
			Immutable().
			Default(time.Now).
			SchemaType(map[string]string{dialect.Postgres: "timestamptz"}),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now).
			SchemaType(map[string]string{dialect.Postgres: "timestamptz"}),
	}
}

func (SubscriptionPlan) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("groups", Group.Type).
			Through("plan_groups", SubscriptionPlanGroup.Type),
		edge.To("user_subscriptions", UserSubscription.Type),
		edge.To("redeem_codes", RedeemCode.Type),
	}
}

func (SubscriptionPlan) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("for_sale"),
	}
}
