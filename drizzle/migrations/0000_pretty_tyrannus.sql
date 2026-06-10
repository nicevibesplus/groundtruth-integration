CREATE TABLE "weather_osem_match" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(50) NOT NULL,
	"external_station_id" varchar(50) NOT NULL,
	"phenomenon" varchar(50) NOT NULL,
	"osem_box_id" varchar(24) NOT NULL,
	"osem_sensor_id" varchar(24) NOT NULL,
	"access_token" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "provider_station_phenomenon_idx" ON "weather_osem_match" USING btree ("provider","external_station_id","phenomenon");