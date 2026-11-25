import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import {
  router,
  useFocusEffect,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  trackEvent,
  trackScreenView,
} from "@/services/analytics";
import { searchPosts } from "@/services/api";
import {
  getSavedPosts,
  toggleSavedPost,
} from "@/services/savedPosts";
import type { Post } from "@/types/Post";
import { formatDisplayDate } from "@/utils/formatDisplayDate";

function mergeUniquePosts(
  existingPosts: Post[],
  incomingPosts: Post[]
): Post[] {
  const postMap =
    new Map<number, Post>();

  existingPosts.forEach(
    (post) => {
      postMap.set(
        post.id,
        post
      );
    }
  );

  incomingPosts.forEach(
    (post) => {
      postMap.set(
        post.id,
        post
      );
    }
  );

  return Array.from(
    postMap.values()
  );
}

export default function SearchScreen() {
  const requestIdRef =
    useRef(0);

  const [
    query,
    setQuery,
  ] =
    useState("");

  const [
    activeQuery,
    setActiveQuery,
  ] =
    useState("");

  const [
    results,
    setResults,
  ] =
    useState<Post[]>([]);

  const [
    savedPostIds,
    setSavedPostIds,
  ] =
    useState<number[]>([]);

  const [
    savingPostId,
    setSavingPostId,
  ] =
    useState<
      number | null
    >(null);

  const [
    nextPage,
    setNextPage,
  ] =
    useState<
      number | null
    >(null);

  const [
    hasSearched,
    setHasSearched,
  ] =
    useState(false);

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(false);

  const [
    isLoadingMore,
    setIsLoadingMore,
  ] =
    useState(false);

  const [
    isRefreshing,
    setIsRefreshing,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState<
      string | null
    >(null);

  useEffect(() => {
    trackScreenView(
      "search"
    );
  }, []);

  const refreshSavedPostIds =
    useCallback(
      async () => {
        try {
          const savedPosts =
            await getSavedPosts();

          setSavedPostIds(
            savedPosts.map(
              (post) =>
                post.id
            )
          );
        } catch {
          setSavedPostIds(
            []
          );
        }
      },
      []
    );

  useFocusEffect(
    useCallback(() => {
      void refreshSavedPostIds();
    }, [
      refreshSavedPostIds,
    ])
  );

  const runSearch =
    useCallback(
      async (
        searchQuery: string,
        page = 1,
        mode:
          | "initial"
          | "refresh"
          | "more" =
          "initial"
      ) => {
        const trimmedQuery =
          searchQuery.trim();

        if (!trimmedQuery) {
          setResults(
            []
          );

          setActiveQuery(
            ""
          );

          setNextPage(
            null
          );

          setHasSearched(
            false
          );

          setErrorMessage(
            null
          );

          return;
        }

        const requestId =
          ++requestIdRef.current;

        try {
          if (
            mode ===
            "initial"
          ) {
            setIsLoading(
              true
            );

            setResults(
              []
            );

            setNextPage(
              null
            );
          } else if (
            mode ===
            "refresh"
          ) {
            setIsRefreshing(
              true
            );
          } else {
            setIsLoadingMore(
              true
            );
          }

          setHasSearched(
            true
          );

          setErrorMessage(
            null
          );

          const response =
            await searchPosts(
              trimmedQuery,
              page
            );

          if (
            requestId !==
            requestIdRef.current
          ) {
            return;
          }

          setActiveQuery(
            trimmedQuery
          );

          if (
            mode ===
            "more"
          ) {
            setResults(
              (
                currentResults
              ) =>
                mergeUniquePosts(
                  currentResults,
                  response.posts
                )
            );
          } else {
            setResults(
              mergeUniquePosts(
                [],
                response.posts
              )
            );
          }

          setNextPage(
            response.nextPage
          );
        } catch {
          if (
            requestId !==
            requestIdRef.current
          ) {
            return;
          }

          setErrorMessage(
            mode ===
              "more"
              ? "Unable to load more search results."
              : "Unable to search stories right now."
          );
        } finally {
          if (
            requestId ===
            requestIdRef.current
          ) {
            setIsLoading(
              false
            );

            setIsLoadingMore(
              false
            );

            setIsRefreshing(
              false
            );
          }
        }
      },
      []
    );

  const handleSearch =
    useCallback(() => {
      const trimmedQuery =
        query.trim();

      Keyboard.dismiss();

      if (!trimmedQuery) {
        requestIdRef.current +=
          1;

        setResults(
          []
        );

        setActiveQuery(
          ""
        );

        setNextPage(
          null
        );

        setHasSearched(
          false
        );

        setErrorMessage(
          null
        );

        return;
      }

      trackEvent(
        "screen_view",
        {
          screenName:
            "search",
          action:
            "search",
          query:
            trimmedQuery,
        }
      );

      void runSearch(
        trimmedQuery,
        1,
        "initial"
      );
    }, [
      query,
      runSearch,
    ]);

  const handleLoadMore =
    useCallback(() => {
      if (
        !activeQuery ||
        nextPage ===
          null ||
        isLoading ||
        isLoadingMore ||
        isRefreshing
      ) {
        return;
      }

      void runSearch(
        activeQuery,
        nextPage,
        "more"
      );
    }, [
      activeQuery,
      isLoading,
      isLoadingMore,
      isRefreshing,
      nextPage,
      runSearch,
    ]);

  const handleRefresh =
    useCallback(() => {
      if (
        !activeQuery ||
        isLoading
      ) {
        return;
      }

      void runSearch(
        activeQuery,
        1,
        "refresh"
      );
    }, [
      activeQuery,
      isLoading,
      runSearch,
    ]);

  const handleClearSearch =
    useCallback(() => {
      requestIdRef.current +=
        1;

      setQuery(
        ""
      );

      setActiveQuery(
        ""
      );

      setResults(
        []
      );

      setNextPage(
        null
      );

      setHasSearched(
        false
      );

      setErrorMessage(
        null
      );

      setIsLoading(
        false
      );

      setIsLoadingMore(
        false
      );

      setIsRefreshing(
        false
      );

      Keyboard.dismiss();
    }, []);

  const handleToggleSaved =
    useCallback(
      async (
        post: Post
      ) => {
        if (
          savingPostId !==
          null
        ) {
          return;
        }

        try {
          setSavingPostId(
            post.id
          );

          const isNowSaved =
            await toggleSavedPost(
              post
            );

          setSavedPostIds(
            (
              currentIds
            ) => {
              if (
                isNowSaved
              ) {
                if (
                  currentIds.includes(
                    post.id
                  )
                ) {
                  return currentIds;
                }

                return [
                  ...currentIds,
                  post.id,
                ];
              }

              return currentIds.filter(
                (id) =>
                  id !==
                  post.id
              );
            }
          );

          if (
            isNowSaved
          ) {
            trackEvent(
              "saved_story",
              {
                source:
                  "search",
                postId:
                  post.id,
                title:
                  post.title,
              }
            );
          }
        } catch {
          setErrorMessage(
            "Unable to update saved story. Please try again."
          );
        } finally {
          setSavingPostId(
            null
          );
        }
      },
      [
        savingPostId,
      ]
    );

  const renderResult =
    useCallback(
      ({
        item,
      }: {
        item: Post;
      }) => {
        const isSaved =
          savedPostIds.includes(
            item.id
          );

        const isSaving =
          savingPostId ===
          item.id;

        return (
          <Pressable
            style={
              styles.resultCard
            }
            onPress={() => {
              trackEvent(
                "article_open",
                {
                  source:
                    "search",
                  postId:
                    item.id,
                  title:
                    item.title,
                }
              );

              router.push({
                pathname:
                  "/(tabs)/article",
                params: {
                  id: String(
                    item.id
                  ),
                  fresh:
                    "1",
                },
              });
            }}
          >
            {item.image ? (
              <Image
                source={{
                  uri:
                    item.image,
                }}
                style={
                  styles.resultImage
                }
                contentFit="cover"
                transition={
                  200
                }
                cachePolicy="memory-disk"
                recyclingKey={String(
                  item.id
                )}
              />
            ) : (
              <View
                style={
                  styles.imagePlaceholder
                }
              >
                <Ionicons
                  name="newspaper-outline"
                  size={34}
                  color="#999"
                />
              </View>
            )}

            <Pressable
              style={
                styles.bookmarkButton
              }
              disabled={
                isSaving
              }
              onPress={(
                event
              ) => {
                event.stopPropagation();

                void handleToggleSaved(
                  item
                );
              }}
              accessibilityRole="button"
              accessibilityLabel={
                isSaved
                  ? "Remove saved story"
                  : "Save story"
              }
            >
              <Ionicons
                name={
                  isSaved
                    ? "bookmark"
                    : "bookmark-outline"
                }
                size={22}
                color={
                  isSaved
                    ? "#b00020"
                    : "#111"
                }
              />
            </Pressable>

            <View
              style={
                styles.resultBody
              }
            >
              <View
                style={
                  styles.resultMetaRow
                }
              >
                <Text
                  style={
                    styles.category
                  }
                >
                  {
                    item.category
                  }
                </Text>

                <Text
                  style={
                    styles.date
                  }
                >
                  {formatDisplayDate(
                    item.date
                  )}
                </Text>
              </View>

              <Text
                style={
                  styles.resultTitle
                }
              >
                {
                  item.title
                }
              </Text>

              {item.author ? (
                <Text
                  style={
                    styles.author
                  }
                >
                  By{" "}
                  {
                    item.author
                  }
                </Text>
              ) : null}

              {item.excerpt ? (
                <Text
                  style={
                    styles.excerpt
                  }
                  numberOfLines={
                    3
                  }
                >
                  {
                    item.excerpt
                  }
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      },
      [
        handleToggleSaved,
        savedPostIds,
        savingPostId,
      ]
    );

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
      edges={[
        "top",
        "left",
        "right",
      ]}
    >
      <StatusBar
        style="light"
      />

      <View
        style={
          styles.container
        }
      >
        <Text
          style={
            styles.title
          }
        >
          Search Stories
        </Text>

        <View
          style={
            styles.searchRow
          }
        >
          <View
            style={
              styles.inputContainer
            }
          >
            <TextInput
              value={
                query
              }
              onChangeText={
                setQuery
              }
              placeholder="Search news, sports, breaking..."
              placeholderTextColor="#777"
              style={
                styles.input
              }
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={
                false
              }
              clearButtonMode="never"
              onSubmitEditing={
                handleSearch
              }
            />

            {query.length >
            0 ? (
              <Pressable
                style={
                  styles.clearButton
                }
                onPress={
                  handleClearSearch
                }
                accessibilityLabel="Clear search"
              >
                <Ionicons
                  name="close-circle"
                  size={21}
                  color="#777"
                />
              </Pressable>
            ) : null}
          </View>

          <Pressable
            style={[
              styles.searchButton,
              isLoading &&
                styles.searchButtonDisabled,
            ]}
            onPress={
              handleSearch
            }
            disabled={
              isLoading
            }
            accessibilityRole="button"
            accessibilityLabel="Search"
          >
            {isLoading ? (
              <ActivityIndicator
                size="small"
                color="#fff"
              />
            ) : (
              <Ionicons
                name="search"
                size={20}
                color="#fff"
              />
            )}
          </Pressable>
        </View>

        {activeQuery &&
        !isLoading ? (
          <Text
            style={
              styles.resultsLabel
            }
          >
            Results for “
            {activeQuery}”
          </Text>
        ) : null}

        <FlatList
          data={
            results
          }
          keyExtractor={(
            item
          ) =>
            String(
              item.id
            )
          }
          renderItem={
            renderResult
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={
            false
          }
          removeClippedSubviews={
            false
          }
          contentContainerStyle={
            results.length ===
            0
              ? styles.emptyContainer
              : styles.resultsContainer
          }
          refreshControl={
            <RefreshControl
              refreshing={
                isRefreshing
              }
              onRefresh={
                handleRefresh
              }
              enabled={
                Boolean(
                  activeQuery
                ) &&
                !isLoading
              }
            />
          }
          onEndReached={
            handleLoadMore
          }
          onEndReachedThreshold={
            0.45
          }
          ListEmptyComponent={
            <View
              style={
                styles.centerState
              }
            >
              {isLoading ? (
                <>
                  <ActivityIndicator
                    size="large"
                  />

                  <Text
                    style={
                      styles.emptyText
                    }
                  >
                    Searching the story archive...
                  </Text>
                </>
              ) : errorMessage ? (
                <>
                  <Ionicons
                    name="alert-circle-outline"
                    size={42}
                    color="#999"
                  />

                  <Text
                    style={
                      styles.emptyText
                    }
                  >
                    {
                      errorMessage
                    }
                  </Text>

                  {activeQuery ? (
                    <Pressable
                      style={
                        styles.retryButton
                      }
                      onPress={() =>
                        void runSearch(
                          activeQuery,
                          1,
                          "initial"
                        )
                      }
                    >
                      <Text
                        style={
                          styles.retryButtonText
                        }
                      >
                        Try Again
                      </Text>
                    </Pressable>
                  ) : null}
                </>
              ) : (
                <>
                  <Ionicons
                    name="search-outline"
                    size={42}
                    color="#999"
                  />

                  <Text
                    style={
                      styles.emptyText
                    }
                  >
                    {hasSearched
                      ? `No stories matched “${activeQuery || query.trim()}.”`
                      : "Search the Your Daily Local story archive."}
                  </Text>
                </>
              )}
            </View>
          }
          ListFooterComponent={
            results.length >
            0 ? (
              <View
                style={
                  styles.footer
                }
              >
                {isLoadingMore ? (
                  <>
                    <ActivityIndicator
                      size="small"
                    />

                    <Text
                      style={
                        styles.footerText
                      }
                    >
                      Loading more stories...
                    </Text>
                  </>
                ) : errorMessage ? (
                  <>
                    <Text
                      style={
                        styles.footerErrorText
                      }
                    >
                      {
                        errorMessage
                      }
                    </Text>

                    {nextPage !==
                    null ? (
                      <Pressable
                        style={
                          styles.loadMoreButton
                        }
                        onPress={
                          handleLoadMore
                        }
                      >
                        <Text
                          style={
                            styles.loadMoreButtonText
                          }
                        >
                          Try Again
                        </Text>
                      </Pressable>
                    ) : null}
                  </>
                ) : nextPage ===
                  null ? (
                  <Text
                    style={
                      styles.footerText
                    }
                  >
                    End of results
                  </Text>
                ) : null}
              </View>
            ) : null
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      backgroundColor:
        "#111",
      flex: 1,
    },

    container: {
      backgroundColor:
        "#f6f6f6",
      borderTopLeftRadius:
        18,
      borderTopRightRadius:
        18,
      flex: 1,
      paddingHorizontal:
        16,
      paddingTop: 16,
    },

    title: {
      color: "#111",
      fontSize: 28,
      fontWeight: "900",
      marginBottom: 18,
      marginTop: 2,
    },

    searchRow: {
      flexDirection:
        "row",
      marginBottom: 12,
    },

    inputContainer: {
      flex: 1,
      justifyContent:
        "center",
      position:
        "relative",
    },

    input: {
      backgroundColor:
        "#fff",
      borderColor:
        "#ddd",
      borderRadius: 14,
      borderWidth: 1,
      fontSize: 16,
      paddingHorizontal:
        14,
      paddingRight: 44,
      paddingVertical:
        14,
    },

    clearButton: {
      alignItems:
        "center",
      height: 42,
      justifyContent:
        "center",
      position:
        "absolute",
      right: 2,
      width: 42,
    },

    searchButton: {
      alignItems:
        "center",
      backgroundColor:
        "#b00020",
      borderRadius: 14,
      justifyContent:
        "center",
      marginLeft: 10,
      minWidth: 56,
      paddingHorizontal:
        18,
    },

    searchButtonDisabled: {
      opacity: 0.7,
    },

    resultsLabel: {
      color: "#666",
      fontSize: 13,
      fontWeight: "700",
      marginBottom: 14,
    },

    resultsContainer: {
      paddingBottom: 28,
    },

    resultCard: {
      backgroundColor:
        "#fff",
      borderRadius: 18,
      marginBottom: 16,
      overflow: "hidden",
      position:
        "relative",
    },

    resultImage: {
      backgroundColor:
        "#ddd",
      height: 185,
      width: "100%",
    },

    imagePlaceholder: {
      alignItems:
        "center",
      backgroundColor:
        "#e5e5e5",
      height: 150,
      justifyContent:
        "center",
      width: "100%",
    },

    bookmarkButton: {
      alignItems:
        "center",
      backgroundColor:
        "rgba(255,255,255,0.94)",
      borderRadius: 999,
      height: 40,
      justifyContent:
        "center",
      position:
        "absolute",
      right: 12,
      top: 12,
      width: 40,
      zIndex: 2,
    },

    resultBody: {
      padding: 15,
    },

    resultMetaRow: {
      alignItems:
        "center",
      flexDirection:
        "row",
      justifyContent:
        "space-between",
      marginBottom: 7,
    },

    category: {
      color: "#b00020",
      flexShrink: 1,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing:
        0.4,
      marginRight: 12,
      textTransform:
        "uppercase",
    },

    date: {
      color: "#888",
      flexShrink: 0,
      fontSize: 11,
      fontWeight: "600",
    },

    resultTitle: {
      color: "#111",
      fontSize: 20,
      fontWeight: "900",
      lineHeight: 25,
    },

    author: {
      color: "#555",
      fontSize: 12,
      fontWeight: "700",
      marginTop: 7,
    },

    excerpt: {
      color: "#555",
      fontSize: 14,
      lineHeight: 21,
      marginTop: 9,
    },

    centerState: {
      alignItems:
        "center",
      flex: 1,
      justifyContent:
        "center",
      padding: 24,
    },

    emptyContainer: {
      flexGrow: 1,
    },

    emptyText: {
      color: "#666",
      fontSize: 15,
      lineHeight: 22,
      marginTop: 10,
      maxWidth: 280,
      textAlign:
        "center",
    },

    retryButton: {
      backgroundColor:
        "#b00020",
      borderRadius: 999,
      marginTop: 18,
      paddingHorizontal:
        20,
      paddingVertical:
        11,
    },

    retryButtonText: {
      color: "#fff",
      fontSize: 14,
      fontWeight: "800",
    },

    footer: {
      alignItems:
        "center",
      justifyContent:
        "center",
      minHeight: 62,
      paddingBottom: 8,
      paddingTop: 6,
    },

    footerText: {
      color: "#777",
      fontSize: 13,
      marginTop: 8,
      textAlign:
        "center",
    },

    footerErrorText: {
      color: "#777",
      fontSize: 13,
      marginBottom: 10,
      textAlign:
        "center",
    },

    loadMoreButton: {
      backgroundColor:
        "#444",
      borderRadius: 999,
      paddingHorizontal:
        18,
      paddingVertical: 9,
    },

    loadMoreButtonText: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "800",
    },
  });