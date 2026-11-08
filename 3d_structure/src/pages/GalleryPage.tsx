import { BrandMark } from '../components/BrandMark'
import { CollectionCard } from '../components/CollectionCard'
import { catalog } from '../content/catalog'
import type { ExhibitId } from '../content/types'
import '../styles/gallery.css'

interface GalleryPageProps {
  onExplore: (id: ExhibitId) => void
}

const collectionGroups = [
  {
    id: 'large-machines',
    title: '陆海空大型机械',
    items: catalog.filter((item) => item.category !== 'firearm'),
  },
  {
    id: 'firearm-lab',
    title: '发射循环实验室',
    items: catalog.filter((item) => item.category === 'firearm'),
  },
] as const

export function GalleryPage({ onExplore }: GalleryPageProps) {
  return (
    <div className="gallery-page" id="top">
      <header className="museum-header">
        <BrandMark />
        <nav aria-label="主要导航">
          <a href="#collections">
            浏览藏品 <span aria-hidden="true">↘</span>
          </a>
          <a href="#accessibility">无障碍与操作</a>
        </nav>
      </header>

      <main>
        <section className="museum-hero" aria-labelledby="museum-title">
          <p className="museum-hero__eyebrow">A MUSEUM OF INNER WORKINGS</p>
          <h1 id="museum-title" aria-label="拆开机械，看见原理">
            拆开机械，<br />
            <span>看见原理</span>
          </h1>
          <div className="museum-hero__introduction">
            <p>
              这里收藏的是结构如何协作，而不是操作、制造或使用指导。沿着承载、动力与传动，比较不同机制怎样完成一次机械循环。
            </p>
            <a href="#collections">开始今天的观察 ↓</a>
          </div>
          <p className="museum-hero__edition">
            COLLECTION 01—07
          </p>
        </section>

        <section
          className="museum-collections"
          id="collections"
          aria-label="藏品分类"
        >
          <header className="museum-collections__heading">
            <p>SELECTED MECHANICAL ARCHIVES</p>
            <h2>结构藏品目录</h2>
            <span>一次只看懂一件机器</span>
          </header>

          <div className="collection-groups">
            {collectionGroups.map((group, groupIndex) => {
              const titleId = `collection-group-${group.id}-title`

              return (
                <section
                  aria-labelledby={titleId}
                  className={`collection-group collection-group--${group.id}`}
                  key={group.id}
                >
                  <header className="collection-group__heading">
                    <p>ARCHIVE WING / 0{groupIndex + 1}</p>
                    <h3 id={titleId}>{group.title}</h3>
                    <span>
                      {group.id === 'large-machines'
                        ? '承载、推进与稳定的系统观察'
                        : '只观察抽象机械状态，不提供操作指导'}
                    </span>
                  </header>

                  <div
                    className={`collection-grid collection-grid--${group.id}`}
                  >
                    {group.items.map((item) => (
                      <CollectionCard
                        archiveIndex={
                          catalog.findIndex((entry) => entry.id === item.id) + 1
                        }
                        item={item}
                        key={item.id}
                        onExplore={onExplore}
                      />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        </section>

        <section
          className="museum-notebook"
          aria-labelledby="notebook-title"
        >
          <header className="museum-notebook__heading">
            <p>OBSERVATION NOTEBOOK</p>
            <h2 id="notebook-title">今天可以带走的三个问题</h2>
            <span>先提出问题，再拆开结构寻找线索。</span>
          </header>

          <ol
            className="museum-notebook__questions"
            aria-label="三个观察问题"
          >
            <li>
              <span aria-hidden="true">01</span>
              <p>一台机械的外壳与内部结构，分别在承担什么任务？</p>
            </li>
            <li>
              <span aria-hidden="true">02</span>
              <p>动力或能量从哪里出发，又经过哪些结构产生运动？</p>
            </li>
            <li>
              <span aria-hidden="true">03</span>
              <p>不同机制如何让各自的结构完成一次机械循环？</p>
            </li>
          </ol>

          <aside
            className="museum-notebook__accessibility"
            id="accessibility"
            aria-labelledby="accessibility-title"
          >
            <div>
              <span>ACCESS / 01</span>
              <h3 id="accessibility-title">无障碍与操作说明</h3>
            </div>
            <p>
              可使用键盘、鼠标或触控探索；系统开启减少动态时，持续动画会保持静止。
            </p>
            <p>知识卡支持按需主动朗读，页面不会自动播放声音。</p>
          </aside>
        </section>
      </main>

      <footer className="museum-footer">
        <p>公开史料与公共机构资料 · 教育性重建</p>
        <a
          href="https://www.nasa.gov/x-57-maxwell/"
          rel="noreferrer"
          target="_blank"
        >
          NASA X-57 公开项目资料 ↗
        </a>
      </footer>
    </div>
  )
}
