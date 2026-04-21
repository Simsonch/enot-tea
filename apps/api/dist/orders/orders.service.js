var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ConflictException, Injectable, NotFoundException, } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import {} from './orders.dto.js';
let OrdersService = class OrdersService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    cancellableStatuses = new Set([
        OrderStatus.NEW,
        OrderStatus.CONFIRMED,
        OrderStatus.PACKED,
    ]);
    async create(dto) {
        return this.prisma.$transaction(async (tx) => {
            await this.ensureCustomerExists(tx, dto.customerId);
            const requestedItems = this.aggregateItems(dto.items);
            const productIds = requestedItems.map((item) => item.productId);
            const products = await tx.product.findMany({
                where: { id: { in: productIds } },
                select: { id: true, priceMinor: true },
            });
            if (products.length !== productIds.length) {
                throw new NotFoundException('Один или несколько товаров не найдены.');
            }
            const inventory = await tx.inventoryItem.findMany({
                where: { productId: { in: productIds } },
                select: { productId: true, onHand: true, reserved: true },
            });
            if (inventory.length !== productIds.length) {
                throw new NotFoundException('Остатки для одного или нескольких товаров не найдены.');
            }
            const productsById = new Map(products.map((product) => [product.id, product]));
            const inventoryByProductId = new Map(inventory.map((item) => [item.productId, item]));
            let totalMinor = 0;
            for (const requested of requestedItems) {
                const product = productsById.get(requested.productId);
                const stock = inventoryByProductId.get(requested.productId);
                if (!product || !stock) {
                    throw new NotFoundException(`Товар или остаток не найден для productId=${requested.productId}.`);
                }
                const available = stock.onHand - stock.reserved;
                if (available < requested.quantity) {
                    throw new ConflictException(`Недостаточно остатков для товара productId=${requested.productId}.`);
                }
                totalMinor += product.priceMinor * requested.quantity;
            }
            const order = await tx.order.create({
                data: {
                    customerId: dto.customerId,
                    totalMinor,
                    items: {
                        create: requestedItems.map((requested) => {
                            const product = productsById.get(requested.productId);
                            if (!product) {
                                throw new NotFoundException(`Товар productId=${requested.productId} не найден.`);
                            }
                            return {
                                productId: requested.productId,
                                quantity: requested.quantity,
                                priceMinor: product.priceMinor,
                                totalMinor: product.priceMinor * requested.quantity,
                            };
                        }),
                    },
                },
                include: {
                    items: {
                        select: {
                            id: true,
                            productId: true,
                            quantity: true,
                            priceMinor: true,
                            totalMinor: true,
                        },
                    },
                },
            });
            for (const requested of requestedItems) {
                await tx.inventoryItem.update({
                    where: { productId: requested.productId },
                    data: { reserved: { increment: requested.quantity } },
                });
            }
            return order;
        });
    }
    async cancel(orderId) {
        return this.prisma.$transaction(async (tx) => {
            const order = await tx.order.findUnique({
                where: { id: orderId },
                include: {
                    items: {
                        select: {
                            productId: true,
                            quantity: true,
                        },
                    },
                },
            });
            if (!order) {
                throw new NotFoundException(`Заказ orderId=${orderId} не найден.`);
            }
            if (!this.cancellableStatuses.has(order.status)) {
                throw new ConflictException(`Заказ orderId=${orderId} нельзя отменить из статуса ${order.status}.`);
            }
            for (const item of order.items) {
                await tx.inventoryItem.update({
                    where: { productId: item.productId },
                    data: {
                        reserved: {
                            decrement: item.quantity,
                        },
                    },
                });
            }
            const updatedOrder = await tx.order.update({
                where: { id: order.id },
                data: {
                    status: OrderStatus.CANCELLED,
                    statusHistory: {
                        create: {
                            fromStatus: order.status,
                            toStatus: OrderStatus.CANCELLED,
                            comment: 'Отмена заказа',
                        },
                    },
                },
                include: {
                    items: {
                        select: {
                            id: true,
                            productId: true,
                            quantity: true,
                            priceMinor: true,
                            totalMinor: true,
                        },
                    },
                },
            });
            return updatedOrder;
        });
    }
    async getById(orderId) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                items: {
                    select: {
                        id: true,
                        productId: true,
                        quantity: true,
                        priceMinor: true,
                        totalMinor: true,
                    },
                },
                statusHistory: {
                    select: {
                        id: true,
                        fromStatus: true,
                        toStatus: true,
                        comment: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: 'asc' },
                },
            },
        });
        if (!order) {
            throw new NotFoundException(`Заказ orderId=${orderId} не найден.`);
        }
        return order;
    }
    async ensureCustomerExists(tx, customerId) {
        const customer = await tx.user.findUnique({
            where: { id: customerId },
            select: { id: true },
        });
        if (!customer) {
            throw new NotFoundException(`Покупатель customerId=${customerId} не найден.`);
        }
    }
    aggregateItems(items) {
        const quantities = new Map();
        for (const item of items) {
            quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
        }
        return [...quantities.entries()].map(([productId, quantity]) => ({
            productId,
            quantity,
        }));
    }
};
OrdersService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService])
], OrdersService);
export { OrdersService };
//# sourceMappingURL=orders.service.js.map