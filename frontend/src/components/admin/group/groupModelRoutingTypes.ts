export interface GroupRoutingAccount {
  id: number;
  name: string;
}

export interface GroupModelRoutingRule {
  pattern: string;
  accounts: GroupRoutingAccount[];
}
