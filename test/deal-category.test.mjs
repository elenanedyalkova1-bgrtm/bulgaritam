import assert from "node:assert/strict";
import test from "node:test";
import { classifyDealCategory, DEAL_CATEGORIES } from "../src/lib/deal-category.mjs";
const category=(input)=>classifyDealCategory(input).category;
test("catalog category is authoritative and restricted",()=>{assert.equal(category({catalog_category:"Козметика",title:"TEST!"}),"Козметика");assert.equal(category({catalog_category:"Подаръци"}),null);});
test("clear product identities classify conservatively",()=>{assert.equal(category({title:"The Sacred Facial Oil"}),"Козметика");assert.equal(category({title:"Коледен тефтер"}),"Книги, игри и творчество");assert.equal(category({title:"Дамска рокля"}),"Облекло");});
test("site and ambiguous signals fail closed",()=>{assert.equal(category({title:"Shop all",product_url:"https://scarab-cosmetics.com/shop-all"}),null);assert.equal(category({title:"TEST!",product_url:"https://scarab-cosmetics.com/product/test"}),null);assert.equal(category({title:"Мед"}),null);assert.equal(category({title:"Gift box"}),null);assert.equal(category({title:"COCOSOLIS – Сет блясък и шоколадов тен"}),null);assert.equal(category({title:"GOLD CHOCOLATE SERIES BOX"}),null);assert.equal(category({title:"One moment, please..."}),null);});
test("conflicting signals fail closed and output is bounded",()=>{assert.equal(category({title:'Дневник албум „Пръстен“'}),null);for(const input of [{title:"Facial oil"},{title:"Кучешки повод"},{title:"unknown"}])assert.ok(category(input)===null||DEAL_CATEGORIES.includes(category(input)));});
