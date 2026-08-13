package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/Wei-Shaw/sub2api/internal/repository"
	"github.com/Wei-Shaw/sub2api/internal/service"
)

func main() {
	migrationKey := flag.String("migration-key", "", "required account priority migration key")
	confirmed := flag.Bool("confirm-old-instances-stopped", false, "confirm every old application instance is stopped")
	timeout := flag.Duration("timeout", 10*time.Minute, "publisher timeout")
	flag.Parse()
	if *migrationKey == "" {
		log.Fatal("-migration-key is required")
	}
	if !*confirmed {
		log.Fatal("-confirm-old-instances-stopped is required")
	}
	if *migrationKey != service.AccountPrioritySemanticMigrationKey {
		log.Fatalf("migration key must be %q", service.AccountPrioritySemanticMigrationKey)
	}

	base, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	ctx, cancel := context.WithTimeout(base, *timeout)
	defer cancel()

	cfg, err := config.LoadForBootstrap()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}
	entClient, db, err := repository.InitEntForMaintenance(cfg)
	if err != nil {
		log.Fatalf("initialize database: %v", err)
	}
	defer func() { _ = entClient.Close() }()
	rdb := repository.InitRedis(cfg)
	defer func() { _ = rdb.Close() }()

	cache := repository.ProvideSchedulerCache(rdb, cfg)
	accountRepo := repository.NewAccountRepository(entClient, db, cache)
	groupRepo := repository.NewGroupRepository(entClient, db)
	snapshot := service.NewSchedulerSnapshotService(cache, repository.NewSchedulerOutboxRepository(db), accountRepo, groupRepo, cfg)
	publisher := service.NewAccountPrioritySemanticPublisher(
		repository.NewAccountPriorityPublicationRepository(db),
		snapshot,
		cache,
		groupRepo,
		cfg,
	)

	if err := publisher.Publish(ctx, *migrationKey); err != nil {
		log.Fatalf("publish account priority semantics: %v", err)
	}
	fmt.Printf("account priority semantic publication %q completed\n", *migrationKey)
}
