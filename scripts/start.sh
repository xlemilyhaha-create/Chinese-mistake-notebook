#!/bin/bash

# 启动脚本 - 根据环境选择不同的配置
# 用法: ./scripts/start.sh [dev|prod]

set -e

ENV=${1:-dev}

case $ENV in
  dev|development)
    echo "启动开发环境..."
    if [ ! -f .env.dev ]; then
      if [ -f env.dev.example ]; then
        echo "复制 env.dev.example 为 .env.dev"
        cp env.dev.example .env.dev
        echo "请编辑 .env.dev 并配置相应参数后重新运行"
        exit 1
      else
        echo "错误: .env.dev 文件不存在"
        echo "请创建 .env.dev 并配置相应参数"
        exit 1
      fi
    fi
    docker-compose -f docker-compose.dev.yml --env-file .env.dev up -d
    echo "开发环境已启动"
    echo "MySQL 端口: $(grep MYSQL_PORT .env.dev | cut -d '=' -f2)"
    echo "应用端口: $(grep APP_PORT .env.dev | cut -d '=' -f2)"
    ;;
  prod|production)
    echo "启动生产环境..."
    if [ ! -f .env.prod ]; then
      if [ -f env.prod.example ]; then
        echo "复制 env.prod.example 为 .env.prod"
        cp env.prod.example .env.prod
        echo "请编辑 .env.prod 并配置相应参数后重新运行"
        exit 1
      else
        echo "错误: .env.prod 文件不存在"
        echo "请创建 .env.prod 并配置相应参数"
        exit 1
      fi
    fi
    docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
    echo "生产环境已启动"
    echo "MySQL 端口: $(grep MYSQL_PORT .env.prod | cut -d '=' -f2)"
    echo "应用端口: $(grep APP_PORT .env.prod | cut -d '=' -f2)"
    ;;
  *)
    echo "用法: $0 [dev|prod]"
    echo ""
    echo "  dev   - 启动开发环境"
    echo "  prod  - 启动生产环境"
    exit 1
    ;;
esac

echo ""
echo "查看日志: docker-compose -f docker-compose.${ENV}.yml logs -f"
echo "停止服务: docker-compose -f docker-compose.${ENV}.yml down"
